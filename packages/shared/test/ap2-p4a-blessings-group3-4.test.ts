import { describe, expect, it } from 'vitest';
import {
  ALL_ACTION_BLESSING_IDS,
  ALL_BLESSING_IDS,
  ALL_PHASE1_BLESSING_IDS,
  BLESSINGS,
  BLESSING_LIST,
  BULLET_MOD_BLESSING_IDS,
  type BlessingId,
  type BulletVolleySpawnEvent,
  CORE_ACTION_BLESSING_IDS,
  DASH_TECH_BLESSING_IDS,
  FLOOR_BUFFS,
  FLOOR_BUFF_LIST,
  I18nManager,
  INPUT_BUTTON,
  MAX_DEPLOYABLES_PER_PLAYER,
  MAX_TACTICAL_PROPS_PER_ROOM,
  NetworkTransport,
  PHASE4_ACTION_BLESSING_IDS,
  PHASE4_BULLET_MOD_BLESSING_IDS,
  PHASE4_DASH_TECH_BLESSING_IDS,
  PHASE4_RELOAD_TECH_BLESSING_IDS,
  PHASE4_TABLE_TECH_BLESSING_IDS,
  RELOAD_TECH_BLESSING_IDS,
  SHOT_FLAG,
  SKILL_UPGRADE_BLESSING_IDS,
  TABLE_TECH_BLESSING_IDS,
  WEAPONS,
  WorldSim,
  encodeWorldSnapshot,
  enLocale,
  isCircularKickableToyProp,
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

function createCleanArenaSim(seed = 20261029): WorldSim {
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

describe('AP2 Phase P4A.2 — Advanced Group 3 (Reload/Vent) & Group 4 (Bullet Geometry) Blessings + 60Hz Sync', () => {
  it('1. registers Group 3 & 4 Phase 4 blessings (34 total), preserves Phase 1 arrays (26), and maintains 100% vi/en parity', () => {
    expect(TABLE_TECH_BLESSING_IDS).toHaveLength(4);
    expect(DASH_TECH_BLESSING_IDS).toHaveLength(4);
    expect(RELOAD_TECH_BLESSING_IDS).toHaveLength(4);
    expect(BULLET_MOD_BLESSING_IDS).toHaveLength(4);
    expect(CORE_ACTION_BLESSING_IDS).toHaveLength(16);
    expect(SKILL_UPGRADE_BLESSING_IDS).toHaveLength(10);
    expect(ALL_PHASE1_BLESSING_IDS).toHaveLength(26);

    expect(PHASE4_RELOAD_TECH_BLESSING_IDS).toEqual([
      'reload_caustic_pod',
      'reload_holster_surge',
    ]);
    expect(PHASE4_BULLET_MOD_BLESSING_IDS).toEqual([
      'bullet_wall_tether',
      'bullet_orbit_return',
    ]);
    expect(PHASE4_ACTION_BLESSING_IDS).toEqual([
      ...PHASE4_TABLE_TECH_BLESSING_IDS,
      ...PHASE4_DASH_TECH_BLESSING_IDS,
      ...PHASE4_RELOAD_TECH_BLESSING_IDS,
      ...PHASE4_BULLET_MOD_BLESSING_IDS,
    ]);
    expect(PHASE4_ACTION_BLESSING_IDS).toHaveLength(8);
    expect(ALL_ACTION_BLESSING_IDS).toHaveLength(24);
    expect(ALL_BLESSING_IDS).toHaveLength(34);
    expect(BLESSING_LIST).toHaveLength(34);
    expect(FLOOR_BUFF_LIST).toHaveLength(34);
    expect(Object.keys(FLOOR_BUFFS)).toHaveLength(34);

    expect(BLESSINGS.reload_caustic_pod).toMatchObject({
      id: 'reload_caustic_pod',
      nameVi: 'Nang Độc Lăn Nảy',
      nameEn: 'Caustic Rolling Pod',
      blessingGroup: 'reload_tech',
      element: 'poison',
      accentColor: '#84CC16',
      category: 'general',
      descriptionVi:
        'Khi Nạp Chuẩn / Xả Nhiệt [R] hoặc bắn Phát Cuối Băng, phóng Quả Nang Bào Tử lăn 120px; bắn trúng hoặc Dash-Kick kích nổ mưa axit (38 ST Độc, +25% ST nhận vào).',
      descriptionEn:
        'On Perfect Reload / Vent [R] or Finale Shot, launch a Caustic Spore Pod rolling 120px; shooting or Dash-Kicking it detonates acid rain (38 Poison DMG, +25% enemy vulnerability).',
    });

    expect(BLESSINGS.reload_holster_surge).toMatchObject({
      id: 'reload_holster_surge',
      nameVi: 'Dòng Điện Đổi Súng',
      nameEn: 'Holster Surge',
      blessingGroup: 'reload_tech',
      element: 'shock',
      accentColor: '#38BDF8',
      category: 'general',
      descriptionVi:
        'Khi đổi vũ khí bằng [Q] (hồi chiêu 2.0s), phóng 1 tia sét (26 ST Sét) xuyên qua quái trước mặt và nạp đầy ngay vũ khí vừa cất.',
      descriptionEn:
        'Swapping weapons with [Q] (2.0s ICD) fires a piercing lightning bolt (26 Shock DMG) ahead and instantly reloads/cools your holstered weapon.',
    });

    expect(BLESSINGS.bullet_wall_tether).toMatchObject({
      id: 'bullet_wall_tether',
      nameVi: 'Đạn Ghim Tường Giăng Dây',
      nameEn: 'Wall-Tether Pylons',
      blessingGroup: 'bullet_mod',
      element: 'shock',
      accentColor: '#FACC15',
      category: 'general',
      descriptionVi:
        'Khi Phát Cuối Băng hoặc Đạn Quá Tải chạm tường, cắm Cọc Điện Cao Thế (4.5s, tối đa 2 cọc/người). Hai cọc căng Dây Cắt Điện (26 ST Sét/giây).',
      descriptionEn:
        'When a Finale Shot or Overclocked Shot hits a wall, plant a High-Voltage Pylon (4.5s, max 2/player). Two pylons stretch an Electric Cutter Wire (26 Shock DMG/s).',
    });

    expect(BLESSINGS.bullet_orbit_return).toMatchObject({
      id: 'bullet_orbit_return',
      nameVi: 'Quỹ Đạo Hồi Quy',
      nameEn: 'Orbit Return',
      blessingGroup: 'bullet_mod',
      element: 'poison',
      accentColor: '#10B981',
      category: 'general',
      descriptionVi:
        'Đạn tầm xa khi bay hết tầm sẽ vòng ngược 180° bay trả về vị trí hiện tại của bạn, gây 45% ST Độc từ sau lưng quái.',
      descriptionEn:
        'Ranged projectiles reaching max range curve 180° back toward your current position, dealing 45% Poison DMG from behind enemies.',
    });

    expect(collectLeafKeys(viLocale)).toEqual(collectLeafKeys(enLocale));

    const i18n = new I18nManager('vi');
    const newIds: readonly BlessingId[] = [
      ...PHASE4_RELOAD_TECH_BLESSING_IDS,
      ...PHASE4_BULLET_MOD_BLESSING_IDS,
    ];
    for (const id of newIds) {
      i18n.setLocale('vi');
      expect(i18n.t(`buffs.${id}.name`)).toBe(BLESSINGS[id].nameVi);
      expect(i18n.t(`buffs.${id}.desc`)).toBe(BLESSINGS[id].descriptionVi);
      i18n.setLocale('en');
      expect(i18n.t(`buffs.${id}.name`)).toBe(BLESSINGS[id].nameEn);
      expect(i18n.t(`buffs.${id}.desc`)).toBe(BLESSINGS[id].descriptionEn);
    }

    const sim = createCleanArenaSim(4201);
    const rolled = new Set<string>();
    for (let i = 0; i < 80; i++) {
      sim.rollPendingBuffChoices();
      for (const c of sim.player.buffChoices) {
        rolled.add(c);
      }
      sim.player.buffChoices = [];
    }
    for (const id of newIds) {
      expect(rolled.has(id)).toBe(true);
    }
  });

  describe('2. reload_caustic_pod (Caustic Rolling Pod)', () => {
    it('2a. launches a rolling pod (120px @ 240px/s) on Perfect Reload, Tactical Vent, valid Melee Hit 3, and Finale Shot — NEVER on empty-air melee swing', () => {
      const sim = createCleanArenaSim(4202);
      const p = sim.player;
      p.blessingIds = ['reload_caustic_pod'];
      expect(isCircularKickableToyProp('caustic_spore_pod')).toBe(true);

      // (1) Perfect Reload [R] on CLIP_RELOAD weapon
      p.weaponSlots = ['rivet_gun'];
      p.activeWeaponSlot = 0;
      p.clipMax = WEAPONS.rivet_gun.clipSize;
      p.clipAmmo = 2;
      p.reloadDuration = 1.0;
      p.reloadTimer = 0.5; // 50% progress -> inside [0.42, 0.60] sweet spot
      p.reloadLockout = false;
      p.reloadBlessingIcdTimer = 0;

      const expectedSpawnX = p.x + 20;
      stepSim(sim, 1 / 60, INPUT_BUTTON.RELOAD_VENT, 0);
      const pod1 = sim.props.find((pr) => pr.kind === 'caustic_spore_pod' && pr.hp > 0);
      expect(pod1).toBeDefined();
      expect(pod1!.radius).toBe(14);
      expect(pod1!.hp).toBe(1);
      expect(pod1!.destructible).toBe(true);
      expect(pod1!.explosive).toBe(true);
      expect(pod1!.blocksMovement).toBe(false);
      expect(pod1!.ownerPlayerId).toBe(p.id);

      // Step 0.6s -> pod rolls exact 120px from spawn origin and stops cleanly
      stepSim(sim, 0.6, 0, 0);
      expect(pod1!.x - expectedSpawnX).toBeCloseTo(120, 0);
      expect(pod1!.vx).toBe(0);
      expect(pod1!.vy).toBe(0);
      expect(pod1!.causticRollRemainingPx ?? 0).toBe(0);

      // (2) Tactical Vent [R] on HEAT_VENT weapon
      sim.props.length = 0;
      p.reloadBlessingIcdTimer = 0;
      p.weaponSlots = ['gale_smg'];
      p.activeWeaponSlot = 0;
      p.weaponHeat = 65; // >= 40% threshold
      p.overheatLockTimer = 0;
      p.ventCooldownTimer = 0;

      stepSim(sim, 1 / 60, INPUT_BUTTON.RELOAD_VENT, 0);
      expect(sim.props.filter((pr) => pr.kind === 'caustic_spore_pod' && pr.hp > 0)).toHaveLength(1);

      // (3) Empty-air 3rd Melee Combo swing -> MUST NOT spawn any pod!
      sim.props.length = 0;
      p.reloadBlessingIcdTimer = 0;
      p.weaponSlots = ['knight_sword'];
      p.activeWeaponSlot = 0;
      p.meleeComboStep = 2; // next swing is 3rd hit finisher
      p.fireCooldownTimer = 0;
      sim.enemies.length = 0;
      sim.projectiles.length = 0;

      sim.tryFireActiveWeapon(p);
      expect(sim.props.filter((pr) => pr.kind === 'caustic_spore_pod')).toHaveLength(0);

      // (4) Valid 3rd Melee Combo swing hitting >= 1 enemy -> spawns pod!
      p.reloadBlessingIcdTimer = 0;
      p.meleeComboStep = 2;
      p.fireCooldownTimer = 0;
      const meleeTarget = sim.spawnEnemy('goblin_shooter', p.x + 36, p.y, false);
      meleeTarget.aiState = 'chase';
      meleeTarget.hp = 500;
      meleeTarget.maxHp = 500;

      sim.tryFireActiveWeapon(p);
      expect(sim.props.filter((pr) => pr.kind === 'caustic_spore_pod' && pr.hp > 0)).toHaveLength(1);

      // (4b) Valid 3rd Melee Combo swing parrying >= 1 enemy bullet (0 enemies hit) -> ALSO spawns pod!
      sim.enemies.length = 0;
      sim.props.length = 0;
      p.reloadBlessingIcdTimer = 0;
      p.meleeComboStep = 2;
      p.fireCooldownTimer = 0;
      sim.spawnDeterministicVolley(
        {
          kind: 'bullet_volley_spawned',
          tick: sim.tick,
          ownerId: 999,
          team: 'enemy',
          weaponId: 'goblin_bow',
          x: p.x + 30,
          y: p.y,
          angle: Math.PI,
          pelletCount: 1,
          spreadRad: 0,
          speed: 240,
          damage: 8,
          radius: 5,
          knockback: 10,
          pierceCount: 0,
          bounceCount: 0,
          ttlSec: 1.0,
          element: 'none',
          critChance: 0,
          amplifiedByShield: false,
          seed: 4202,
        },
        true,
      );
      sim.tryFireActiveWeapon(p);
      expect(sim.props.filter((pr) => pr.kind === 'caustic_spore_pod' && pr.hp > 0)).toHaveLength(1);

      // (4c) Chasm roll-stop safety: rolling pod stops at chasm edge instead of rolling onto chasm tile
      stepSim(sim, 1 / 60, 0, 0); // release RELOAD_VENT button from earlier step
      sim.props.length = 0;
      const chasmTx = Math.floor((p.x + 72) / 32);
      const chasmTy = Math.floor(p.y / 32);
      sim.map.setSurface(chasmTx, chasmTy, 'chasm', 999, true);
      p.reloadBlessingIcdTimer = 0;
      p.weaponSlots = ['gale_smg'];
      p.activeWeaponSlot = 0;
      p.weaponHeat = 65;
      p.ventCooldownTimer = 0;
      stepSim(sim, 1 / 60, INPUT_BUTTON.RELOAD_VENT, 0);
      stepSim(sim, 0.5, 0, 0);
      const chasmStoppedPod = sim.props.find((pr) => pr.kind === 'caustic_spore_pod' && pr.hp > 0)!;
      expect(chasmStoppedPod).toBeDefined();
      expect(sim.map.getSurfaceAtWorld(chasmStoppedPod.x, chasmStoppedPod.y)).not.toBe('chasm');
      expect(chasmStoppedPod.vx).toBe(0);
      sim.map.setSurface(chasmTx, chasmTy, 'none', 0, true);

      // (5) Finale Shot (clipAmmo === 1 on CLIP_RELOAD gun) -> launches Finale bullet AND rolling pod without self-popping on spawn!
      sim.enemies.length = 0;
      sim.props.length = 0;
      sim.projectiles.length = 0;
      p.weaponSlots = ['rivet_gun'];
      p.activeWeaponSlot = 0;
      p.clipMax = WEAPONS.rivet_gun.clipSize;
      p.clipAmmo = 1;
      p.reloadTimer = 0;
      p.fireCooldownTimer = 0;
      p.causticPodFinaleIcdTimer = 0;

      sim.tryFireActiveWeapon(p);
      stepSim(sim, 0.1, 0, 0);
      const finalePods = sim.props.filter((pr) => pr.kind === 'caustic_spore_pod' && pr.hp > 0);
      expect(finalePods).toHaveLength(1);
      expect(finalePods[0]!.x).toBeGreaterThan(p.x + 30);
    });

    it('2b. detonates on shot or Dash-Kick for 38 scaled Poison DMG (r=96) + poison_swamp + +25% causticVulnTimer (capped <= 1.75x) and enforces MAX_TACTICAL_PROPS_PER_ROOM = 16', () => {
      const sim = createCleanArenaSim(4203);
      sim.currentFloor = 3;
      const p = sim.player;
      p.blessingIds = ['reload_caustic_pod'];

      // Spawn a caustic pod via Perfect Reload and let it roll to a stop at x ≈ 560
      p.weaponSlots = ['rivet_gun'];
      p.activeWeaponSlot = 0;
      p.clipMax = 6;
      p.clipAmmo = 2;
      p.reloadDuration = 1.0;
      p.reloadTimer = 0.5;
      stepSim(sim, 1 / 60, INPUT_BUTTON.RELOAD_VENT, 0);
      stepSim(sim, 0.55, 0, 0);

      const pod = sim.props.find((pr) => pr.kind === 'caustic_spore_pod' && pr.hp > 0)!;
      expect(pod).toBeDefined();

      // Place enemy 50px south of resting pod (within r = 96px, off the bullet line)
      const victim = sim.spawnEnemy('goblin_shooter', pod.x, pod.y + 50, false);
      victim.aiState = 'idle';
      victim.stateTimer = 99;
      victim.hp = 2000;
      victim.maxHp = 2000;

      // Shoot the resting pod with a real player projectile -> detonates immediately in place
      const hpBeforeShot = victim.hp;
      sim.spawnDeterministicVolley(
        {
          kind: 'bullet_volley_spawned',
          tick: sim.tick,
          ownerId: p.id,
          team: 'player',
          weaponId: 'rivet_gun',
          x: pod.x - 24,
          y: pod.y,
          angle: 0,
          pelletCount: 1,
          spreadRad: 0,
          speed: 700,
          damage: 9,
          radius: 5,
          knockback: 40,
          pierceCount: 0,
          bounceCount: 0,
          ttlSec: 0.5,
          element: 'none',
          critChance: 0,
          amplifiedByShield: false,
          seed: 4203,
        },
        true,
      );
      for (let step = 0; step < 6 && pod.hp > 0; step++) {
        sim.updateProjectiles(1 / 60);
      }

      const expectedExplosionDmg = scaleBlessingDamage(38, 3);
      expect(pod.hp).toBe(0);
      expect(hpBeforeShot - victim.hp).toBe(expectedExplosionDmg);
      expect(victim.poisonTimer).toBeGreaterThan(0);
      expect(victim.causticVulnTimer).toBeCloseTo(5.0, 2);
      expect(sim.map.getSurfaceAtWorld(pod.x, pod.y)).toBe('poison_swamp');

      // Verify +25% caustic vulnerability in 3-Bucket Damage Pipeline (100 * 1.25 = 125)
      const hpBeforeFollowUp = victim.hp;
      sim.applyDamageToEnemy(victim, 100, false, 'none', 0, 0, false, p.id);
      expect(hpBeforeFollowUp - victim.hp).toBe(125);

      // Stack marked (+25%) + superconduct (+25%) + caustic (+25%) + bossArmorBreak (+50%) = 2.25x -> MUST hard-cap at 1.75x!
      victim.markedTimer = 4.0;
      victim.superconductTimer = 4.0;
      victim.bossArmorBreakVulnTimer = 4.0;
      const hpBeforeCapCheck = victim.hp;
      sim.applyDamageToEnemy(victim, 100, false, 'none', 0, 0, false, p.id);
      expect(hpBeforeCapCheck - victim.hp).toBe(175);

      // Decay causticVulnTimer over dtSec
      victim.markedTimer = 0;
      victim.superconductTimer = 0;
      victim.bossArmorBreakVulnTimer = 0;
      victim.poisonTimer = 0;
      victim.poisonStacks = 0;
      sim.map.surfaces.fill('none');
      stepSim(sim, 5.1, 0, 0);
      expect(victim.causticVulnTimer ?? 0).toBe(0);

      // Dash-Kick detonation test
      sim.enemies.length = 0;
      sim.props.length = 0;
      p.reloadBlessingIcdTimer = 0;
      p.clipAmmo = 5;
      p.reloadDuration = 1.0;
      p.reloadTimer = 0.5;
      stepSim(sim, 1 / 60, INPUT_BUTTON.RELOAD_VENT, 0);
      const kickPod = sim.props.find((pr) => pr.kind === 'caustic_spore_pod' && pr.hp > 0)!;
      expect(kickPod).toBeDefined();

      const kickTarget = sim.spawnEnemy('goblin_shooter', p.x + 170, p.y, false);
      kickTarget.aiState = 'chase';
      kickTarget.hp = 1000;
      kickTarget.maxHp = 1000;

      // Dash forward into kickPod -> launches at 520 px/s and detonates on kickTarget!
      p.dashCooldownTimer = 0;
      stepSim(sim, 1 / 60, INPUT_BUTTON.DASH, 0, 1, 0);
      stepSim(sim, 0.45, 0, 0);
      expect(kickPod.hp).toBe(0);
      expect(kickTarget.hp).toBeLessThan(1000);
      expect(kickTarget.causticVulnTimer ?? 0).toBeGreaterThan(0);

      // MAX_TACTICAL_PROPS_PER_ROOM = 16 enforcement
      sim.props.length = 0;
      for (let i = 0; i < MAX_TACTICAL_PROPS_PER_ROOM; i++) {
        sim.spawnProp('wooden_crate', 120 + (i % 8) * 36, 120 + Math.floor(i / 8) * 36);
      }
      expect(sim.props).toHaveLength(MAX_TACTICAL_PROPS_PER_ROOM);

      p.reloadBlessingIcdTimer = 0;
      p.clipAmmo = 5;
      p.reloadDuration = 1.0;
      p.reloadTimer = 0.5;
      stepSim(sim, 1 / 60, INPUT_BUTTON.RELOAD_VENT, 0);
      expect(sim.props.filter((pr) => pr.hp > 0).length).toBeLessThanOrEqual(
        MAX_TACTICAL_PROPS_PER_ROOM,
      );
      expect(sim.props.some((pr) => pr.kind === 'caustic_spore_pod' && pr.hp > 0)).toBe(true);
    });
  });

  describe('3. reload_holster_surge (Holster Surge)', () => {
    it('3. fires a piercing 26 scaled Shock lightning bolt (~260px), instantly refills/cools holstered weapon, and enforces 2.0s ICD', () => {
      const sim = createCleanArenaSim(4204);
      sim.currentFloor = 2;
      const p = sim.player;
      p.blessingIds = ['reload_holster_surge'];
      p.weaponSlots = ['rivet_gun', 'gale_smg'];
      p.activeWeaponSlot = 0;
      const carbineMax = WEAPONS.rivet_gun.clipSize;
      p.clipMax = carbineMax;
      p.clipAmmo = 2; // nearly empty clip
      p.weaponSlotClipAmmo = [2, 0];
      p.weaponSlotHeat = [0, 0];
      p.holsterReloadTimers = [0, 0];
      p.holsterSurgeIcdTimer = 0;

      // Line up 2 stationary enemies within ~260px (> 115px apart so Shock chain lightning does not cross-hit) and 1 out of range at 380px
      const nearEnemy1 = sim.spawnEnemy('goblin_shooter', p.x + 55, p.y, false);
      const nearEnemy2 = sim.spawnEnemy('goblin_shooter', p.x + 230, p.y, false);
      const farEnemy = sim.spawnEnemy('goblin_shooter', p.x + 380, p.y, false);
      for (const e of [nearEnemy1, nearEnemy2, farEnemy]) {
        e.aiState = 'idle';
        e.moveSpeed = 0;
        e.attackCooldownTimer = 99;
        e.hp = 1000;
        e.maxHp = 1000;
      }

      // Press [Q] (INPUT_BUTTON.SWAP) -> swap slot 0 -> slot 1
      stepSim(sim, 1 / 60, INPUT_BUTTON.SWAP, 0);
      expect(p.activeWeaponSlot).toBe(1);
      expect(p.holsterSurgeIcdTimer).toBeGreaterThan(1.9);
      // Holstered vanguard_carbine (slot 0) is instantly refilled to full clipSize!
      expect(p.weaponSlotClipAmmo[0]).toBe(carbineMax);
      expect(p.holsterReloadTimers[0]).toBe(0);

      // Step 0.4s so piercing bolt (~260px @ 820px/s, ttl=0.32s) completes flight
      stepSim(sim, 0.4, 0, 0);
      const expectedBoltDmg = scaleBlessingDamage(26, 2);
      expect(1000 - nearEnemy1.hp).toBe(expectedBoltDmg);
      expect(1000 - nearEnemy2.hp).toBe(expectedBoltDmg);
      expect(nearEnemy1.shockTimer).toBeGreaterThan(0);
      expect(nearEnemy2.shockTimer).toBeGreaterThan(0);
      expect(farEnemy.hp).toBe(1000);

      // Heat up frost_railgun (slot 1) to 75 heat and swap back WHILE ICD > 0 -> NO bolt, NO instant cool!
      p.weaponHeat = 75;
      const e1HpBeforeBlockedSwap = nearEnemy1.hp;
      stepSim(sim, 1 / 60, INPUT_BUTTON.SWAP, 0);
      expect(p.activeWeaponSlot).toBe(0);
      expect(p.clipAmmo).toBe(carbineMax); // slot 0 was already refilled from first swap!
      expect(p.weaponSlotHeat[1]).toBe(75); // NOT cooled because 2.0s ICD was active!
      stepSim(sim, 0.35, 0, 0);
      expect(nearEnemy1.hp).toBe(e1HpBeforeBlockedSwap);

      // Swap back to slot 1, wait until 2.0s ICD finishes, heat slot 1 to 80, then swap -> cools slot 1 to 0 & fires bolt!
      sim.cycleWeapon(1); // back to slot 1 (frost_railgun)
      stepSim(sim, 2.05, 0, 0);
      expect(p.holsterSurgeIcdTimer ?? 0).toBe(0);

      p.weaponHeat = 80;
      const e1HpBeforeReadySwap = nearEnemy1.hp;
      stepSim(sim, 1 / 60, INPUT_BUTTON.SWAP, 0);
      expect(p.activeWeaponSlot).toBe(0);
      expect(p.weaponSlotHeat[1]).toBe(0); // instantly cooled!
      stepSim(sim, 0.4, 0, 0);
      expect(e1HpBeforeReadySwap - nearEnemy1.hp).toBe(expectedBoltDmg);
    });
  });

  describe('4. bullet_wall_tether (Wall-Tether Pylons & Electric Cutter Wire)', () => {
    it('4a. plants wall_tether_pylon (4.5s, max 2/player) ONLY on Finale/Overclocked wall hits and stretches 26 scaled Shock DMG/s cutter wire', () => {
      const sim = createCleanArenaSim(4205);
      sim.currentFloor = 2;
      const p = sim.player;
      p.blessingIds = ['bullet_wall_tether'];

      const spawnWallShot = (angle: number, shotFlags: number): void => {
        const ev: BulletVolleySpawnEvent = {
          kind: 'bullet_volley_spawned',
          tick: sim.tick,
          ownerId: p.id,
          team: 'player',
          weaponId: 'rivet_gun',
          x: p.x,
          y: p.y,
          angle,
          pelletCount: 1,
          spreadRad: 0,
          speed: 900,
          damage: 15,
          radius: 5,
          knockback: 20,
          pierceCount: 0,
          bounceCount: 0,
          ttlSec: 2.0,
          element: 'none',
          critChance: 0,
          amplifiedByShield: false,
          seed: 777,
          shotFlags,
        };
        sim.spawnDeterministicVolley(ev, true);
      };

      // (1) Normal bullet (shotFlags = 0) hitting top wall -> 0 pylons
      spawnWallShot(-Math.PI / 2, 0);
      stepSim(sim, 0.35, 0, 0);
      expect(sim.summons.filter((s) => s.kind === 'wall_tether_pylon')).toHaveLength(0);

      // (2) Finale Shot hitting top wall + Overclocked Shot hitting bottom wall -> 2 pylons stretched vertically across x ≈ 420
      spawnWallShot(-Math.PI / 2, SHOT_FLAG.FINALE_SHOT);
      spawnWallShot(Math.PI / 2, SHOT_FLAG.OVERCLOCKED_SHOT);
      stepSim(sim, 0.5, 0, 0);

      const pylons = sim.summons.filter(
        (s) => s.kind === 'wall_tether_pylon' && s.ownerPlayerId === p.id && s.ttlSec > 0,
      );
      expect(pylons).toHaveLength(2);
      expect(pylons[0]!.maxTtlSec).toBeCloseTo(4.5, 2);

      // Place one enemy on the cutter wire segment (x = 420, y = 260) and one off-line (x = 620, y = 260)
      p.x = 200;
      p.y = 260;
      const wireEnemy = sim.spawnEnemy('goblin_shooter', 420, 260, false);
      const safeEnemy = sim.spawnEnemy('goblin_shooter', 620, 260, false);
      for (const e of [wireEnemy, safeEnemy]) {
        e.aiState = 'idle';
        e.stateTimer = 99;
        e.hp = 1000;
        e.maxHp = 1000;
      }

      // Step 1.0s (4 ticks @ 0.25s) -> deals ~scaleBlessingDamage(26, 2) Shock DMG + shock status
      const expectedTickDmg = Math.max(1, Math.round(scaleBlessingDamage(26, 2) * 0.25));
      stepSim(sim, 1.0, 0, 0);
      const dealt = 1000 - wireEnemy.hp;
      expect(dealt).toBeGreaterThanOrEqual(expectedTickDmg * 3);
      expect(dealt).toBeLessThanOrEqual(expectedTickDmg * 5);
      expect(wireEnemy.shockTimer).toBeGreaterThan(0);
      expect(safeEnemy.hp).toBe(1000);

      // (3) 3rd Finale Shot hitting left wall evicts oldest pylon so active pylon count stays strictly 2
      const oldestPylonId = pylons[0]!.id;
      spawnWallShot(Math.PI, SHOT_FLAG.FINALE_SHOT);
      stepSim(sim, 0.45, 0, 0);
      const pylonsAfter3rd = sim.summons.filter(
        (s) => s.kind === 'wall_tether_pylon' && s.ownerPlayerId === p.id && s.ttlSec > 0,
      );
      expect(pylonsAfter3rd).toHaveLength(2);
      expect(pylonsAfter3rd.some((s) => s.id === oldestPylonId)).toBe(false);
    });

    it('4b. enforces MAX_DEPLOYABLES_PER_PLAYER = 8 across summons + magneticRivets when planting wall_tether_pylon', () => {
      const sim = createCleanArenaSim(4206);
      const p = sim.player;
      p.blessingIds = ['bullet_wall_tether'];

      // Pre-fill 4 life blossoms + 4 magnetic rivets = 8 deployables for player 1
      for (let i = 0; i < 4; i++) {
        sim.spawnSeedGunLifeBlossom(p.id, 200 + i * 24, 220);
      }
      for (let i = 0; i < 4; i++) {
        sim.magneticRivets.push({
          id: ++sim.nextEntityId,
          ownerPlayerId: p.id,
          x: 200 + i * 24,
          y: 300,
          ttlSec: 6.0,
          pullTimer: 0.2,
          exploded: false,
        });
      }
      expect(sim.summons.length + sim.magneticRivets.length).toBe(MAX_DEPLOYABLES_PER_PLAYER);

      // Fire 2 Finale Shots into top & bottom walls -> plants 2 pylons while keeping total deployables <= 8!
      for (const ang of [-Math.PI / 2, Math.PI / 2]) {
        sim.spawnDeterministicVolley(
          {
            kind: 'bullet_volley_spawned',
            tick: sim.tick,
            ownerId: p.id,
            team: 'player',
            weaponId: 'rivet_gun',
            x: p.x,
            y: p.y,
            angle: ang,
            pelletCount: 1,
            spreadRad: 0,
            speed: 900,
            damage: 15,
            radius: 5,
            knockback: 20,
            pierceCount: 0,
            bounceCount: 0,
            ttlSec: 2.0,
            element: 'none',
            critChance: 0,
            amplifiedByShield: false,
            seed: 888,
            shotFlags: SHOT_FLAG.FINALE_SHOT,
          },
          true,
        );
      }
      stepSim(sim, 0.5, 0, 0);

      const activeSummons = sim.summons.filter(
        (s) => s.ownerPlayerId === p.id && s.hp > 0 && s.ttlSec > 0,
      );
      const activeRivets = sim.magneticRivets.filter(
        (r) => r.ownerPlayerId === p.id && !r.exploded && r.ttlSec > 0,
      );
      expect(activeSummons.filter((s) => s.kind === 'wall_tether_pylon')).toHaveLength(2);
      expect(activeSummons.length + activeRivets.length).toBeLessThanOrEqual(
        MAX_DEPLOYABLES_PER_PLAYER,
      );
    });
  });

  describe('5. bullet_orbit_return (Orbit Return + 60Hz Server-Client Deterministic Sync)', () => {
    it('5a. curves ranged projectiles 180° back toward owner current position at max range for 45% Poison DMG from behind, catches near owner, never loops twice, and excludes melee/special projectiles', () => {
      const sim = createCleanArenaSim(4207);
      const p = sim.player;
      p.blessingIds = ['bullet_orbit_return'];
      p.x = 240;
      p.y = 260;

      // Spawn an iron_shielder facing WEST (aimAngle = Math.PI, shielding hits from player in front) at x = 400, y = 260
      // Fire bullet slightly off-axis or past enemy first, then move player so return trajectory strikes enemy from BEHIND (east -> west)!
      const shielder = sim.spawnEnemy('iron_shielder', 390, 310, false);
      shielder.aiState = 'idle';
      shielder.stateTimer = 99;
      shielder.aimAngle = Math.PI; // frontal shield faces west toward x = 240
      shielder.hp = 1000;
      shielder.maxHp = 1000;

      // Fire ranged shot eastward at y = 240 (misses shielder at y = 310 on outbound leg; reaches max range around x = 540, y = 240 after 0.5s)
      sim.spawnDeterministicVolley(
        {
          kind: 'bullet_volley_spawned',
          tick: sim.tick,
          ownerId: p.id,
          team: 'player',
          weaponId: 'rivet_gun',
          x: p.x,
          y: 240,
          angle: 0,
          pelletCount: 1,
          spreadRad: 0,
          speed: 600,
          damage: 100,
          radius: 6,
          knockback: 20,
          pierceCount: 2,
          bounceCount: 0,
          ttlSec: 0.5, // 300px max range -> expires around (540, 240) without hitting wall!
          element: 'none',
          critChance: 0,
          amplifiedByShield: false,
          seed: 901,
        },
        true,
      );
      const outbound = sim.projectiles[0]!;
      expect((outbound.shotFlags ?? 0) & SHOT_FLAG.DYNAMIC_BOUNCE).not.toBe(0);
      const outboundId = outbound.id;

      // Reposition player to (240, 380) BEFORE expiry so line from (540, 240) -> (240, 380) passes right through shielder (390, 310) from behind!
      p.x = 240;
      p.y = 380;
      sim.consumeEvents();

      // Step just past 0.5s expiry -> outbound expires & redirects toward (240, 380)
      stepSim(sim, 0.52, 0, 0);
      const events = sim.consumeEvents();
      const returnVolleyEv = events.find(
        (ev): ev is BulletVolleySpawnEvent =>
          ev.kind === 'bullet_volley_spawned' && ev.replacedProjectileId === outboundId,
      );
      expect(returnVolleyEv).toBeDefined();
      expect(returnVolleyEv!.orbitReturned).toBe(true);
      expect(returnVolleyEv!.element).toBe('poison');
      expect(returnVolleyEv!.damage).toBe(45); // Math.round(100 * 0.45)

      const returningProj = sim.projectiles.find((pr) => pr.orbitReturned);
      expect(returningProj).toBeDefined();
      expect(returningProj!.vx).toBeLessThan(0);
      expect(returningProj!.vy).toBeGreaterThan(0);

      // Step return flight: hits iron_shielder from behind (45 Poison DMG + poison status), then gets caught near owner and NEVER loops a 2nd time!
      stepSim(sim, 0.8, 0, 0);
      expect(1000 - shielder.hp).toBe(45);
      expect(shielder.poisonTimer).toBeGreaterThan(0);
      expect(sim.projectiles.filter((pr) => pr.team === 'player')).toHaveLength(0);
      const postReturnEvents = sim.consumeEvents();
      expect(
        postReturnEvents.some(
          (ev) => ev.kind === 'bullet_volley_spawned' && ev.orbitReturned,
        ),
      ).toBe(false);

      // Excluded special/melee projectiles MUST NOT orbit-return on expiry
      const excludedWeaponIds = [
        'void_staff',
        'emerald_cleaver',
        'emerald_cleaver_boomerang',
        'knight_sword',
        'berserker_axe',
        'thunder_hammer',
        'shockwave_edge_blade',
        'dash_phase_blade',
        'mutator_boomerang_saw',
        'tediore_chuck',
      ];
      for (const excludedId of excludedWeaponIds) {
        sim.projectiles.length = 0;
        sim.consumeEvents();
        sim.spawnDeterministicVolley(
          {
            kind: 'bullet_volley_spawned',
            tick: sim.tick,
            ownerId: p.id,
            team: 'player',
            weaponId: excludedId,
            x: 320,
            y: 240,
            angle: 0,
            pelletCount: 1,
            spreadRad: 0,
            speed: 450,
            damage: 40,
            radius: 6,
            knockback: 10,
            pierceCount: 1,
            bounceCount: 0,
            ttlSec: 0.1,
            element: 'none',
            critChance: 0,
            amplifiedByShield: false,
            seed: 902,
          },
          true,
        );
        stepSim(sim, 0.2, 0, 0);
        const evs = sim.consumeEvents();
        expect(
          evs.some((ev) => ev.kind === 'bullet_volley_spawned' && ev.orbitReturned),
        ).toBe(false);
      }
    });

    it('5b. synchronizes Zero-Rubberband Client Hold & deterministic replacedProjectileId across 60Hz Server -> NetworkTransport snapshots', () => {
      const serverSim = createCleanArenaSim(4208);
      const clientTransport = new NetworkTransport({
        seed: 4208,
        startInHub: false,
        spawnInitialWave: false,
        includeTrainingDummy: false,
        includeProps: false,
        localPlayerId: 1,
        localPlayerSlot: 1,
        wifiProfile: 'off',
      });
      const clientSim = clientTransport.getSim();
      clientSim.enemies.length = 0;
      clientSim.props.length = 0;

      // Equip rivet_gun + bullet_orbit_return on authoritative server and sync initial snapshot
      serverSim.player.blessingIds = ['bullet_orbit_return'];
      serverSim.player.weaponSlots = ['rivet_gun'];
      serverSim.player.activeWeaponSlot = 0;
      serverSim.player.clipMax = 6;
      serverSim.player.clipAmmo = 6;
      serverSim.player.x = 260;
      serverSim.player.y = 260;

      clientTransport.receiveSnapshot(
        encodeWorldSnapshot(serverSim, serverSim.consumeEvents(), false, 1000),
      );
      expect(clientSim.player.blessingIds).toContain('bullet_orbit_return');

      // Server spawns a short-range ranged bullet (ttlSec = 0.20s = 12 ticks @ 60Hz)
      serverSim.spawnDeterministicVolley(
        {
          kind: 'bullet_volley_spawned',
          tick: serverSim.tick,
          ownerId: serverSim.player.id,
          team: 'player',
          weaponId: 'rivet_gun',
          x: serverSim.player.x,
          y: serverSim.player.y,
          angle: 0,
          pelletCount: 1,
          spreadRad: 0,
          speed: 540,
          damage: 60,
          radius: 5,
          knockback: 20,
          pierceCount: 1,
          bounceCount: 0,
          ttlSec: 0.2,
          element: 'none',
          critChance: 0,
          amplifiedByShield: false,
          seed: 4208,
        },
        true,
      );
      const serverOutboundId = serverSim.projectiles[0]!.id;

      // Transmit spawn snapshot to client -> identical deterministic projectile ID!
      clientTransport.receiveSnapshot(
        encodeWorldSnapshot(serverSim, serverSim.consumeEvents(), false, 1016),
      );
      expect(clientSim.projectiles.map((pr) => pr.id)).toEqual([serverOutboundId]);
      const clientOutbound = clientSim.projectiles[0]!;
      expect((clientOutbound.shotFlags ?? 0) & SHOT_FLAG.DYNAMIC_BOUNCE).not.toBe(0);

      // Advance client 13 cosmetic ticks (0.216s) BEFORE server redirect snapshot arrives:
      // Zero-Rubberband Client Hold MUST freeze projectile at max range instead of deleting it!
      for (let i = 0; i < 13; i++) {
        clientSim.stepClientProjectilesCosmetic(1 / 60);
      }
      expect(clientSim.projectiles.map((pr) => pr.id)).toEqual([serverOutboundId]);
      expect(clientOutbound.vx).toBe(0);
      expect(clientOutbound.vy).toBe(0);
      expect(clientOutbound.awaitingServerRedirectTimer).toBeGreaterThan(0);
      expect(clientOutbound.awaitingServerRedirectTimer).toBeLessThanOrEqual(0.12);

      // Server moves player slightly and steps past 0.20s expiry -> emits replacement orbit-return volley
      serverSim.player.y = 320;
      for (let i = 0; i < 13; i++) {
        serverSim.step(1 / 60);
      }
      const serverReturnProj = serverSim.projectiles.find((pr) => pr.orbitReturned)!;
      expect(serverReturnProj).toBeDefined();
      expect(serverReturnProj.id).not.toBe(serverOutboundId);

      // Client receives server redirect snapshot -> held projectile is seamlessly replaced with exact same deterministic ID!
      clientTransport.receiveSnapshot(
        encodeWorldSnapshot(serverSim, serverSim.consumeEvents(), false, 1233),
      );
      expect(clientSim.projectiles.map((pr) => pr.id)).toEqual(
        serverSim.projectiles.map((pr) => pr.id),
      );
      const clientReturnProj = clientSim.projectiles[0]!;
      expect(clientReturnProj.id).toBe(serverReturnProj.id);
      expect(clientReturnProj.orbitReturned).toBe(true);
      expect(clientReturnProj.element).toBe('poison');
      expect(clientReturnProj.vx).toBeCloseTo(serverReturnProj.vx, 3);
      expect(clientReturnProj.vy).toBeCloseTo(serverReturnProj.vy, 3);
    });
  });
});
