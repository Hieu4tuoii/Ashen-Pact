import { describe, expect, it } from 'vitest';
import {
  ALL_ACTION_BLESSING_IDS,
  ALL_BLESSING_IDS,
  ALL_PHASE1_BLESSING_IDS,
  BLESSINGS,
  BLESSING_LIST,
  BULLET_MOD_BLESSING_IDS,
  CORE_ACTION_BLESSING_IDS,
  DASH_TECH_BLESSING_IDS,
  FLOOR_BUFFS,
  FLOOR_BUFF_LIST,
  I18nManager,
  INPUT_BUTTON,
  MAX_DEPLOYABLES_PER_PLAYER,
  PHASE4_ACTION_BLESSING_IDS,
  PHASE4_DASH_TECH_BLESSING_IDS,
  PHASE4_TABLE_TECH_BLESSING_IDS,
  RELOAD_TECH_BLESSING_IDS,
  SIM_STEP_SEC,
  SKILL_UPGRADE_BLESSING_IDS,
  TABLE_TECH_BLESSING_IDS,
  TILE_SIZE,
  WorldSim,
  collectLeafKeys,
  distance,
  enLocale,
  enforcePlayerDeployableCap,
  equipPlayerWeaponSlot,
  plantMagneticRivet,
  scaleBlessingDamage,
  triggerBossStaggerBurst,
  viLocale,
} from '../src/index.js';

function createCleanArenaSim(seed = 20261029): WorldSim {
  const sim = new WorldSim({
    seed,
    startInHub: false,
    spawnInitialWave: false,
    includeTrainingDummy: false,
    includeProps: false,
    autoRespawnWaves: false,
  });
  for (let ty = 2; ty < sim.map.rows - 2; ty++) {
    for (let tx = 2; tx < sim.map.cols - 2; tx++) {
      sim.map.setTile(tx, ty, 'floor');
      sim.map.setSurface(tx, ty, 'none', 0, true);
    }
  }
  sim.map.rebuildSolidBoxes();
  sim.props.length = 0;
  sim.enemies.length = 0;
  sim.projectiles.length = 0;
  sim.pickups.length = 0;
  sim.summons.length = 0;
  sim.skillZones.length = 0;
  sim.magneticRivets.length = 0;
  sim.player.x = 10 * TILE_SIZE + 16;
  sim.player.y = 11 * TILE_SIZE + 16;
  sim.player.aimAngle = 0;
  sim.consumeEvents();
  return sim;
}

describe('AP2 Phase P4A.1 — Advanced Group 1 (Barricade) & Group 2 (Dash) Blessings + Bilingual i18n', () => {
  it('registers 4 Phase 4 Group 1 & 2 blessings, preserves Phase 1 arrays (26), maintains 100% vi/en leaf-key parity, and rolls Phase 4 cards in runs', () => {
    expect(TABLE_TECH_BLESSING_IDS).toHaveLength(4);
    expect(DASH_TECH_BLESSING_IDS).toHaveLength(4);
    expect(RELOAD_TECH_BLESSING_IDS).toHaveLength(4);
    expect(BULLET_MOD_BLESSING_IDS).toHaveLength(4);
    expect(CORE_ACTION_BLESSING_IDS).toHaveLength(16);
    expect(SKILL_UPGRADE_BLESSING_IDS).toHaveLength(10);
    expect(ALL_PHASE1_BLESSING_IDS).toHaveLength(26);

    expect(PHASE4_TABLE_TECH_BLESSING_IDS).toEqual([
      'table_tech_toxic_shrapnel',
      'table_tech_magnet_snare',
    ]);
    expect(PHASE4_DASH_TECH_BLESSING_IDS).toEqual([
      'dash_thunder_decoy',
      'dash_phase_blade',
    ]);
    expect(PHASE4_ACTION_BLESSING_IDS).toEqual(
      expect.arrayContaining([
        'table_tech_toxic_shrapnel',
        'table_tech_magnet_snare',
        'dash_thunder_decoy',
        'dash_phase_blade',
      ]),
    );
    expect(ALL_ACTION_BLESSING_IDS).toEqual([
      ...CORE_ACTION_BLESSING_IDS,
      ...PHASE4_ACTION_BLESSING_IDS,
    ]);
    expect(ALL_BLESSING_IDS).toEqual([
      ...ALL_ACTION_BLESSING_IDS,
      ...SKILL_UPGRADE_BLESSING_IDS,
    ]);
    expect(BLESSING_LIST).toHaveLength(ALL_BLESSING_IDS.length);
    expect(FLOOR_BUFF_LIST).toHaveLength(ALL_BLESSING_IDS.length);
    expect(Object.keys(FLOOR_BUFFS)).toHaveLength(ALL_BLESSING_IDS.length);

    expect(BLESSINGS.table_tech_toxic_shrapnel).toMatchObject({
      id: 'table_tech_toxic_shrapnel',
      nameVi: 'Chắn Chiến Gai Độc Nổ',
      nameEn: 'Toxic Shrapnel Barricade',
      blessingGroup: 'table_tech',
      element: 'poison',
      accentColor: '#22C55E',
      category: 'general',
      descriptionVi:
        'Khi tấm chắn hoặc đồ chơi chiến thuật vỡ, hoặc khi kích nổ Đập Tường, bắn tung 8 Mũi Gai Độc 360° (20 ST Độc/mũi) và để lại đầm độc.',
      descriptionEn:
        'When a barricade or tactical prop breaks, or on Wall-Slam, fire 8 Toxic Spines in 360° (20 Poison DMG each) and leave a poison puddle.',
    });

    expect(BLESSINGS.table_tech_magnet_snare).toMatchObject({
      id: 'table_tech_magnet_snare',
      nameVi: 'Chắn Chiến Bẫy Từ Trường',
      nameEn: 'Magnet Snare Barricade',
      blessingGroup: 'table_tech',
      element: 'shock',
      accentColor: '#38BDF8',
      category: 'general',
      descriptionVi:
        'Ngay khi Lật Chắn [E] hoặc Đập Tường, phát xung từ trường kéo tối đa 4 kẻ địch gần nhất trong 180px gom vào mặt trước tấm chắn và Choáng 0.8s.',
      descriptionEn:
        'On Flip Cover [E] or Wall-Slam, emit a magnetic pulse pulling up to 4 nearest enemies within 180px in front of the barricade and Stunning them for 0.8s.',
    });

    expect(BLESSINGS.dash_thunder_decoy).toMatchObject({
      id: 'dash_thunder_decoy',
      nameVi: 'Phân Thân Lôi Ảnh',
      nameEn: 'Thunder Decoy Dash',
      blessingGroup: 'dash_tech',
      element: 'shock',
      accentColor: '#A855F7',
      category: 'general',
      descriptionVi:
        'Tại vị trí bắt đầu Lướt, để lại Tượng Bóng Sét (1.5s) thu hút quái trong 220px; hết giờ hoặc chạm đạn địch sẽ nổ 36 ST Sét (r=88px) và xóa đạn địch.',
      descriptionEn:
        'Leave a Thunder Decoy (1.5s) at Dash start taunting enemies within 220px; on expiry or enemy bullet touch, explodes for 36 Shock DMG (r=88px) and clears enemy bullets.',
    });

    expect(BLESSINGS.dash_phase_blade).toMatchObject({
      id: 'dash_phase_blade',
      nameVi: 'Lướt Xuyên Kiếm Khí',
      nameEn: 'Phase Blade Dash',
      blessingGroup: 'dash_tech',
      element: 'none',
      accentColor: '#E2E8F0',
      category: 'general',
      descriptionVi:
        'Sau mỗi cú Lướt, đòn đánh hoặc phát bắn đầu tiên trong 1.2s phóng kèm Lưỡi Sóng Chấn Động (28 ST) xuyên quái và xóa đạn địch trước mặt.',
      descriptionEn:
        'After each Dash, your first attack or shot within 1.2s launches a piercing Phase Shockwave Blade (28 DMG) that clears enemy bullets ahead.',
    });

    // Bilingual leaf-key parity & I18nManager lookup
    const viKeys = collectLeafKeys(viLocale).sort();
    const enKeys = collectLeafKeys(enLocale).sort();
    expect(viKeys).toEqual(enKeys);

    const i18nVi = new I18nManager('vi');
    const i18nEn = new I18nManager('en');
    for (const id of [
      ...PHASE4_TABLE_TECH_BLESSING_IDS,
      ...PHASE4_DASH_TECH_BLESSING_IDS,
    ]) {
      const def = BLESSINGS[id]!;
      expect(i18nVi.getBuffText(id, '', '')).toEqual({
        name: def.nameVi,
        desc: def.descriptionVi,
      });
      expect(i18nEn.getBuffText(id, '', '')).toEqual({
        name: def.nameEn,
        desc: def.descriptionEn,
      });
    }

    // Verify Phase 4 action blessings can be rolled during runs
    const sim = createCleanArenaSim(8100);
    const rolledIds = new Set<string>();
    for (let i = 0; i < 40; i++) {
      sim.rollPendingBuffChoices();
      for (const c of sim.player.buffChoices) {
        rolledIds.add(c);
      }
      sim.player.buffChoices = [];
    }
    expect(
      [...PHASE4_TABLE_TECH_BLESSING_IDS, ...PHASE4_DASH_TECH_BLESSING_IDS].some((id) =>
        rolledIds.has(id),
      ),
    ).toBe(true);
  });

  it('enforces shared per-player deployable cap (MAX_DEPLOYABLES_PER_PLAYER = 8 across summons + magneticRivets)', () => {
    const sim = createCleanArenaSim(8101);
    const p1 = sim.player;
    const p2 = sim.addCoopPlayer(2, 'engineer', 'P2', 2);

    // P2 owns 1 summon that must NOT be evicted when P1 exceeds cap
    sim.summons.push({
      id: 900,
      kind: 'tesla_turret',
      ownerPlayerId: p2.id,
      x: 200,
      y: 200,
      radius: 14,
      hp: 80,
      maxHp: 80,
      ttlSec: 10,
      maxTtlSec: 10,
      tickTimer: 0.5,
      healsRemaining: 0,
      charge: 0,
      poisonRoots: false,
      selfDestruct: false,
      rootedEnemyIds: [],
      auraRadius: 150,
      nameVi: 'Trụ P2',
    });

    // P1 plants 5 magnetic rivets and 3 summons = 8 total deployables
    for (let i = 0; i < 5; i++) {
      plantMagneticRivet(sim, p1.id, 300 + i * 12, 300, null, null);
    }
    for (let i = 0; i < 3; i++) {
      sim.summons.push({
        id: 100 + i,
        kind: 'tesla_turret',
        ownerPlayerId: p1.id,
        x: 320 + i * 16,
        y: 340,
        radius: 14,
        hp: 80,
        maxHp: 80,
        ttlSec: 10,
        maxTtlSec: 10,
        tickTimer: 0.5,
        healsRemaining: 0,
        charge: 0,
        poisonRoots: false,
        selfDestruct: false,
        rootedEnemyIds: [],
        auraRadius: 150,
        nameVi: `Trụ ${i}`,
      });
    }

    const oldestRivetId = sim.magneticRivets[0]!.id;
    enforcePlayerDeployableCap(sim, p1.id, 2);

    const p1TotalAfter =
      sim.summons.filter((s) => s.ownerPlayerId === p1.id).length +
      sim.magneticRivets.filter((r) => r.ownerPlayerId === p1.id).length;
    expect(p1TotalAfter + 2).toBeLessThanOrEqual(MAX_DEPLOYABLES_PER_PLAYER);
    expect(sim.magneticRivets.some((r) => r.id === oldestRivetId)).toBe(false);
    expect(sim.summons.some((s) => s.id === 900 && s.ownerPlayerId === p2.id)).toBe(true);
  });

  it('implements table_tech_toxic_shrapnel: fires 8 Poison Spines 360° (base 20 Poison DMG) + safe poison_swamp puddle on prop break & Wall-Slam/BossStagger with 0.35s Wall-Slam ICD', () => {
    const sim = createCleanArenaSim(8102);
    sim.currentFloor = 3; // M_floor(3) = 1.44 -> 20 * 1.44 = 29
    const p1 = sim.player;
    p1.blessingIds.push('table_tech_toxic_shrapnel');

    // Surround prop with 1 wall tile and 1 chasm tile to verify poison_swamp NEVER overwrites walls or chasm
    const centerTx = 12;
    const centerTy = 11;
    sim.map.setTile(centerTx + 1, centerTy, 'wall');
    sim.map.setSurface(centerTx - 1, centerTy, 'chasm', 999, true);
    sim.map.rebuildSolidBoxes();

    const table = sim.spawnProp(
      'moss_table',
      centerTx * TILE_SIZE + 16,
      centerTy * TILE_SIZE + 16,
    );
    sim.flipCoverProp(table, p1);

    // 1. Break flipped barricade via damageProp -> 8 Poison Spines in 360° + poison_swamp on walkable floor only
    sim.damageProp(table, 999, 'none');
    expect(table.hp).toBe(0);

    const spines = sim.projectiles.filter(
      (b) => b.weaponId === 'table_tech_toxic_shrapnel',
    );
    expect(spines).toHaveLength(8);
    const expectedSpineDmg = scaleBlessingDamage(20, 3);
    for (let i = 0; i < spines.length; i++) {
      const s = spines[i]!;
      expect(s.element).toBe('poison');
      expect(s.damage).toBe(expectedSpineDmg);
      expect(Math.hypot(s.vx, s.vy)).toBeCloseTo(460, 0);
      expect(s.ttlSec).toBeCloseTo(0.55, 2);
      expect(s.pierceRemaining).toBe(1);
    }

    expect(sim.map.getSurface(centerTx, centerTy)).toBe('poison_swamp');
    expect(sim.map.getTile(centerTx + 1, centerTy)).toBe('wall');
    expect(sim.map.getSurface(centerTx + 1, centerTy)).not.toBe('poison_swamp');
    expect(sim.map.getSurface(centerTx - 1, centerTy)).toBe('chasm');

    // 2. Breaking a sliding tactical prop against a wall also triggers 8 Poison Spines
    sim.projectiles.length = 0;
    const crate = sim.spawnProp('sliding_ice_block', 10 * TILE_SIZE + 16, 13 * TILE_SIZE + 16);
    crate.hp = 15;
    crate.maxHp = 15;
    crate.bouncesRemaining = 0;
    sim.map.setTile(12, 13, 'wall');
    sim.map.rebuildSolidBoxes();
    expect(sim.kickProp(crate, p1, 0)).toBe(true);
    for (let t = 0; t < 15; t++) {
      sim.step(SIM_STEP_SEC);
      if (crate.hp <= 0) break;
    }
    expect(crate.hp).toBe(0);
    expect(
      sim.projectiles.filter((b) => b.weaponId === 'table_tech_toxic_shrapnel').length,
    ).toBeGreaterThanOrEqual(8);

    // 3. Wall-Slam / Boss Stagger triggers 8 Poison Spines and enforces 0.35s Wall-Slam ICD
    sim.projectiles.length = 0;
    p1.toxicShrapnelIcdTimer = 0;
    const boss = sim.spawnEnemy('spore_king', 15 * TILE_SIZE + 16, 11 * TILE_SIZE + 16, true);
    boss.isBoss = true;
    boss.hp = 2000;
    boss.maxHp = 2000;

    triggerBossStaggerBurst(sim, boss, p1.id);
    expect(
      sim.projectiles.filter((b) => b.weaponId === 'table_tech_toxic_shrapnel'),
    ).toHaveLength(8);
    expect(p1.toxicShrapnelIcdTimer).toBeCloseTo(0.35, 2);

    // Second stagger/wall-slam burst within 0.35s ICD must NOT fire a recursive burst
    sim.projectiles.length = 0;
    triggerBossStaggerBurst(sim, boss, p1.id);
    expect(
      sim.projectiles.filter((b) => b.weaponId === 'table_tech_toxic_shrapnel'),
    ).toHaveLength(0);
  });

  it('implements table_tech_magnet_snare: runs AFTER Flip Cover pushback to gather up to 4 nearest enemies within 180px in front of barricade with 0.8s Stun + Shock and safe chasm/wall clamping', () => {
    const sim = createCleanArenaSim(8103);
    const p1 = sim.player;
    p1.blessingIds.push('table_tech_magnet_snare');

    const table = sim.spawnProp('moss_table', 360, 352);
    p1.x = 330;
    p1.y = 352;
    p1.aimAngle = 0; // Front of barricade is +X (east of x = 360)

    // Place 5 enemies within 180px (including 2 inside FLIP_COVER_KNOCKBACK_RADIUS = 92px behind/beside table) + 1 outside 180px
    const eCloseBehind = sim.spawnEnemy('goblin_shooter', 310, 340, true); // ~52px (inside 92px pushback!)
    const eCloseSide = sim.spawnEnemy('goblin_shooter', 360, 290, true); // 62px (inside 92px pushback!)
    const eMid1 = sim.spawnEnemy('goblin_shooter', 360, 480, true); // 128px
    const eMid2 = sim.spawnEnemy('goblin_shooter', 220, 352, true); // 140px
    const eFifth = sim.spawnEnemy('goblin_shooter', 360, 524, true); // 172px (5th nearest -> must NOT be pulled)
    const eOutside = sim.spawnEnemy('goblin_shooter', 560, 352, true); // 200px (> 180px -> untouched)
    for (const e of sim.enemies) {
      e.hp = 600;
      e.maxHp = 600;
    }

    expect(sim.interactWithNearest(p1)).toBe(true);
    expect(table.coverState).toBe('flipped');

    const pulled = [eCloseBehind, eCloseSide, eMid1, eMid2];
    const coords = new Set<string>();
    for (const e of pulled) {
      // Must be gathered in front (+X) of the flipped barricade, NOT pushed behind/away!
      expect(e.x).toBeGreaterThan(table.x + table.radius);
      expect(Math.abs(e.y - table.y)).toBeLessThanOrEqual(24);
      expect(e.kbVx).toBe(0);
      expect(e.kbVy).toBe(0);
      expect(e.stunTimer).toBeGreaterThanOrEqual(0.8);
      expect(e.aiState).toBe('stunned');
      expect(e.shockTimer).toBeGreaterThan(0);
      coords.add(`${e.x.toFixed(1)},${e.y.toFixed(1)}`);
    }
    // Lateral spread ±10px prevents all 4 enemies from stacking on the exact same pixel
    expect(coords.size).toBeGreaterThan(1);

    // 5th enemy within 180px and enemy outside 180px must NOT be stunned or pulled
    expect(eFifth.stunTimer ?? 0).toBe(0);
    expect(eFifth.y).toBeCloseTo(524, 1);
    expect(eOutside.stunTimer ?? 0).toBe(0);
    expect(eOutside.x).toBeCloseTo(560, 1);

    // Chasm safety test: front of barricade points directly into chasm tiles -> pulled enemy stays on safe walkable floor!
    sim.enemies.length = 0;
    sim.props.length = 0;
    const chasmTableTx = 10;
    const chasmTableTy = 8;
    // Make tiles east of table chasm
    for (let dx = 1; dx <= 3; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        sim.map.setSurface(chasmTableTx + dx, chasmTableTy + dy, 'chasm', 999, true);
      }
    }
    sim.spawnProp(
      'moss_table',
      chasmTableTx * TILE_SIZE + 16,
      chasmTableTy * TILE_SIZE + 16,
    );
    p1.x = (chasmTableTx - 1) * TILE_SIZE + 16;
    p1.y = chasmTableTy * TILE_SIZE + 16;
    p1.aimAngle = 0; // Points east directly into chasm!

    const safeEnemy = sim.spawnEnemy(
      'goblin_shooter',
      (chasmTableTx - 2) * TILE_SIZE + 16,
      chasmTableTy * TILE_SIZE + 16,
      true,
    );
    safeEnemy.hp = 500;
    safeEnemy.maxHp = 500;

    expect(sim.interactWithNearest(p1)).toBe(true);
    expect(safeEnemy.stunTimer).toBeGreaterThanOrEqual(0.8);
    expect(sim.map.getSurfaceAtWorld(safeEnemy.x, safeEnemy.y)).not.toBe('chasm');
    const eTx = Math.floor(safeEnemy.x / TILE_SIZE);
    const eTy = Math.floor(safeEnemy.y / TILE_SIZE);
    expect(sim.map.isSolidTile(eTx, eTy)).toBe(false);

    // Wall-Slam / Boss Stagger also triggers magnet snare pull + 0.8s Stun
    const slamCenter = sim.spawnEnemy('spore_king', 320, 480, true);
    slamCenter.isBoss = true;
    slamCenter.hp = 2000;
    slamCenter.maxHp = 2000;
    const bystander = sim.spawnEnemy('goblin_shooter', 450, 480, true); // 130px away (< 180px)
    bystander.hp = 500;
    bystander.maxHp = 500;

    triggerBossStaggerBurst(sim, slamCenter, p1.id);
    expect(bystander.stunTimer).toBeGreaterThanOrEqual(0.8);
    expect(distance(bystander.x, bystander.y, slamCenter.x, slamCenter.y)).toBeLessThan(80);
  });

  it('implements dash_thunder_decoy: spawns 1.5s decoy at Dash start (max 2/player), taunts enemies within 220px, and explodes for base 36 Shock DMG (r=88px) clearing enemy bullets on bullet touch or expiry', () => {
    const sim = createCleanArenaSim(8104);
    sim.currentFloor = 2; // M_floor(2) = 1.22 -> 36 * 1.22 = 44
    const p1 = sim.player;
    p1.blessingIds.push('dash_thunder_decoy');

    const startX = 320;
    const startY = 352;
    p1.x = startX;
    p1.y = startY;

    // 1. Dash eastward -> decoy spawns at exact (startX, startY) before dash displacement
    sim.step({
      moveX: 1,
      moveY: 0,
      aimAngle: 0,
      buttons: INPUT_BUTTON.DASH,
    });

    const decoys = sim.summons.filter((s) => s.kind === 'thunder_decoy');
    expect(decoys).toHaveLength(1);
    const decoy1 = decoys[0]!;
    expect(decoy1.x).toBeCloseTo(startX, 1);
    expect(decoy1.y).toBeCloseTo(startY, 1);
    expect(p1.x).toBeGreaterThan(startX + 5);
    expect(decoy1.radius).toBe(16);
    expect(decoy1.auraRadius).toBe(220);
    expect(decoy1.maxTtlSec).toBe(1.5);
    expect(decoy1.hp).toBe(999);

    // 2. Taunt within 220px: move player far away to the east (x = 700), place chaser north of decoy (140px away < 220px)
    for (let t = 0; t < 15; t++) {
      sim.step({ moveX: 1, moveY: 0, aimAngle: 0, buttons: 0 });
    }
    p1.x = 700;
    p1.y = 352;
    const chaser = sim.spawnEnemy('goblin_shooter', startX, startY - 140, true);
    chaser.hp = 500;
    chaser.maxHp = 500;
    chaser.aiState = 'chase';
    sim.step({ moveX: 0, moveY: 0, aimAngle: 0, buttons: 0 });
    // Chaser aims southward (~ +PI/2) at decoy (320, 352) rather than eastward toward player (700, 352)
    expect(Math.sin(chaser.aimAngle)).toBeGreaterThan(0.85);
    expect(Math.abs(Math.cos(chaser.aimAngle))).toBeLessThan(0.35);

    // 3. Enemy projectile touching decoy triggers immediate explosion (base 36 Shock DMG, r=88px) & clears enemy bullets in r=88px with projectiles_destroyed event
    const victimNear = sim.spawnEnemy('goblin_shooter', startX + 60, startY, true);
    victimNear.hp = 500;
    victimNear.maxHp = 500;
    const victimFar = sim.spawnEnemy('goblin_shooter', startX - 150, startY, true);
    victimFar.hp = 500;
    victimFar.maxHp = 500;

    // Spawn 2 enemy bullets: 1 touching decoy, 1 nearby within r=88px
    sim.spawnDeterministicVolley({
      kind: 'bullet_volley_spawned',
      tick: sim.tick,
      ownerId: victimNear.id,
      team: 'enemy',
      weaponId: 'goblin_bow',
      x: startX + 12,
      y: startY,
      angle: Math.PI,
      pelletCount: 1,
      spreadRad: 0,
      speed: 200,
      damage: 12,
      critChance: 0,
      knockback: 40,
      pierceCount: 0,
      bounceCount: 0,
      ttlSec: 2.0,
      radius: 6,
      element: 'none',
      amplifiedByShield: false,
      seed: 12345,
    });
    sim.spawnDeterministicVolley({
      kind: 'bullet_volley_spawned',
      tick: sim.tick,
      ownerId: victimNear.id,
      team: 'enemy',
      weaponId: 'goblin_bow',
      x: startX,
      y: startY + 70,
      angle: 0,
      pelletCount: 1,
      spreadRad: 0,
      speed: 60,
      damage: 12,
      critChance: 0,
      knockback: 40,
      pierceCount: 0,
      bounceCount: 0,
      ttlSec: 2.0,
      radius: 6,
      element: 'none',
      amplifiedByShield: false,
      seed: 12346,
    });
    const enemyBulletIds = sim.projectiles
      .filter((b) => b.team === 'enemy')
      .map((b) => b.id);
    expect(enemyBulletIds).toHaveLength(2);
    sim.consumeEvents();

    sim.step({ moveX: 0, moveY: 0, aimAngle: 0, buttons: 0 });

    const expectedDecoyDmg = scaleBlessingDamage(36, 2);
    expect(sim.summons.filter((s) => s.kind === 'thunder_decoy')).toHaveLength(0);
    expect(victimNear.hp).toBe(500 - expectedDecoyDmg);
    expect(victimNear.shockTimer).toBeGreaterThan(0);
    expect(victimFar.hp).toBe(500);
    expect(sim.projectiles.filter((b) => b.team === 'enemy')).toHaveLength(0);

    const destroyEvents = sim
      .consumeEvents()
      .filter((ev) => ev.kind === 'projectiles_destroyed');
    const destroyedIds = destroyEvents.flatMap((ev) =>
      ev.kind === 'projectiles_destroyed' ? ev.ids : [],
    );
    for (const id of enemyBulletIds) {
      expect(destroyedIds).toContain(id);
    }

    // 4. Max 2 active decoys per player + expiry detonation after 1.5s
    sim.enemies.length = 0;
    for (let d = 0; d < 3; d++) {
      sim.step({ moveX: 0, moveY: 0, aimAngle: 0, buttons: 0 });
      p1.dashCooldownTimer = 0;
      p1.dashTimer = 0;
      p1.x = 260 + d * 60;
      p1.y = 420;
      sim.step({ moveX: 1, moveY: 0, aimAngle: 0, buttons: INPUT_BUTTON.DASH });
    }
    const activeAfterThree = sim.summons.filter((s) => s.kind === 'thunder_decoy');
    expect(activeAfterThree).toHaveLength(2);

    const lastDecoy = activeAfterThree[activeAfterThree.length - 1]!;
    const expiryVictim = sim.spawnEnemy('green_slime', lastDecoy.x + 50, lastDecoy.y, true);
    expiryVictim.hp = 500;
    expiryVictim.maxHp = 500;

    // Advance past 1.5s so decoys expire and detonate
    for (let t = 0; t < 100; t++) {
      sim.step({ moveX: 0, moveY: 0, aimAngle: 0, buttons: 0 });
    }
    expect(sim.summons.filter((s) => s.kind === 'thunder_decoy')).toHaveLength(0);
    expect(expiryVictim.hp).toBeLessThanOrEqual(500 - expectedDecoyDmg);
  });

  it('implements dash_phase_blade: arms 1.2s window on Dash, consumes ONCE on first ranged shot OR melee swing to launch piercing blade (base 28 DMG) that clears enemy bullets in flight', () => {
    const sim = createCleanArenaSim(8105);
    sim.currentFloor = 4; // M_floor(4) = 1.66 -> 28 * 1.66 = 46
    const p1 = sim.player;
    p1.blessingIds.push('dash_phase_blade');
    equipPlayerWeaponSlot(p1, 0, 'rivet_gun');
    p1.clipAmmo = p1.clipMax;
    p1.x = 240;
    p1.y = 352;

    // 1. Dash arms dashPhaseBladeTimer = 1.2s
    sim.step({ moveX: 1, moveY: 0, aimAngle: 0, buttons: INPUT_BUTTON.DASH });
    expect(p1.dashPhaseBladeTimer).toBeGreaterThan(1.1);
    expect(p1.dashPhaseBladeTimer).toBeLessThanOrEqual(1.2);

    // Finish dash motion while still well inside 1.2s window
    for (let t = 0; t < 14; t++) {
      sim.step({ moveX: 0, moveY: 0, aimAngle: 0, buttons: 0 });
    }
    expect(p1.dashTimer).toBe(0);
    expect(p1.dashPhaseBladeTimer).toBeGreaterThan(0.8);

    // Place 2 lined-up enemies and 1 incoming enemy bullet ahead on the blade flight path
    const enemy1 = sim.spawnEnemy('goblin_shooter', p1.x + 80, p1.y, true);
    enemy1.hp = 600;
    enemy1.maxHp = 600;
    const enemy2 = sim.spawnEnemy('goblin_shooter', p1.x + 140, p1.y, true);
    enemy2.hp = 600;
    enemy2.maxHp = 600;

    sim.spawnDeterministicVolley({
      kind: 'bullet_volley_spawned',
      tick: sim.tick,
      ownerId: enemy2.id,
      team: 'enemy',
      weaponId: 'goblin_bow',
      x: p1.x + 100,
      y: p1.y + 8,
      angle: Math.PI,
      pelletCount: 1,
      spreadRad: 0,
      speed: 120,
      damage: 14,
      critChance: 0,
      knockback: 30,
      pierceCount: 0,
      bounceCount: 0,
      ttlSec: 2.0,
      radius: 6,
      element: 'none',
      amplifiedByShield: false,
      seed: 54321,
    });
    const incomingBulletId = sim.projectiles.find((b) => b.team === 'enemy')!.id;
    sim.consumeEvents();

    // First ranged shot consumes dashPhaseBladeTimer = 0 and spawns 1 dash_phase_blade
    sim.step({ moveX: 0, moveY: 0, aimAngle: 0, buttons: INPUT_BUTTON.FIRE });
    expect(p1.dashPhaseBladeTimer).toBe(0);

    const blades = sim.projectiles.filter((b) => b.weaponId === 'dash_phase_blade');
    expect(blades).toHaveLength(1);
    const blade = blades[0]!;
    const expectedBladeDmg = scaleBlessingDamage(28, 4);
    expect(blade.damage).toBe(expectedBladeDmg);
    expect(blade.element).toBe('none');
    expect(blade.radius).toBe(18);
    expect(blade.pierceRemaining).toBe(8);
    expect(blade.knockback).toBe(160);
    expect(Math.hypot(blade.vx, blade.vy)).toBeCloseTo(560, 0);

    // Let blade fly across incoming bullet + both enemies
    let clearedBulletIds: number[] = [];
    for (let t = 0; t < 18; t++) {
      sim.step({ moveX: 0, moveY: 0, aimAngle: 0, buttons: 0 });
      for (const ev of sim.consumeEvents()) {
        if (ev.kind === 'projectiles_destroyed') {
          clearedBulletIds.push(...ev.ids);
        }
      }
    }
    expect(clearedBulletIds).toContain(incomingBulletId);
    expect(sim.projectiles.some((b) => b.id === incomingBulletId)).toBe(false);
    // Both enemies pierced (enemy1 hit by rivet + phase blade, enemy2 hit by piercing phase blade)
    expect(enemy1.hp).toBeLessThan(600);
    expect(enemy2.hp).toBeLessThanOrEqual(600 - expectedBladeDmg);

    // Second shot without dashing again must NOT spawn another phase blade
    sim.projectiles.length = 0;
    p1.fireCooldownTimer = 0;
    sim.step({ moveX: 0, moveY: 0, aimAngle: 0, buttons: INPUT_BUTTON.FIRE });
    expect(sim.projectiles.filter((b) => b.weaponId === 'dash_phase_blade')).toHaveLength(0);

    // 2. Melee swing within 1.2s after Dash ALSO launches dash_phase_blade
    equipPlayerWeaponSlot(p1, 0, 'berserker_axe');
    p1.fireCooldownTimer = 0;
    p1.dashCooldownTimer = 0;
    sim.step({ moveX: 1, moveY: 0, aimAngle: 0, buttons: INPUT_BUTTON.DASH });
    for (let t = 0; t < 14; t++) {
      sim.step({ moveX: 0, moveY: 0, aimAngle: 0, buttons: 0 });
    }
    expect(p1.dashPhaseBladeTimer).toBeGreaterThan(0);

    sim.projectiles.length = 0;
    sim.step({ moveX: 0, moveY: 0, aimAngle: 0, buttons: INPUT_BUTTON.FIRE });
    expect(p1.dashPhaseBladeTimer).toBe(0);
    expect(sim.projectiles.filter((b) => b.weaponId === 'dash_phase_blade')).toHaveLength(1);

    // 3. Window expires cleanly if player waits > 1.2s after Dash without attacking
    p1.dashCooldownTimer = 0;
    sim.projectiles.length = 0;
    sim.step({ moveX: 1, moveY: 0, aimAngle: 0, buttons: INPUT_BUTTON.DASH });
    for (let t = 0; t < 80; t++) {
      sim.step({ moveX: 0, moveY: 0, aimAngle: 0, buttons: 0 });
    }
    expect(p1.dashPhaseBladeTimer ?? 0).toBe(0);
    p1.fireCooldownTimer = 0;
    sim.step({ moveX: 0, moveY: 0, aimAngle: 0, buttons: INPUT_BUTTON.FIRE });
    expect(sim.projectiles.filter((b) => b.weaponId === 'dash_phase_blade')).toHaveLength(0);
  });

  it('maintains 100% deterministic replay parity across two WorldSim instances using all 4 P4A.1 blessings simultaneously', () => {
    const runReplay = (): string => {
      const sim = createCleanArenaSim(99401);
      sim.currentFloor = 3;
      const p = sim.player;
      p.blessingIds.push(
        'table_tech_toxic_shrapnel',
        'table_tech_magnet_snare',
        'dash_thunder_decoy',
        'dash_phase_blade',
      );
      equipPlayerWeaponSlot(p, 0, 'rivet_gun');
      p.clipAmmo = p.clipMax;

      const table = sim.spawnProp('moss_table', 370, 368);
      sim.spawnEnemy('goblin_shooter', 430, 350, true);
      sim.spawnEnemy('green_slime', 420, 400, true);
      sim.spawnEnemy('wild_boar', 470, 368, true);

      p.x = 340;
      p.y = 368;
      p.aimAngle = 0;
      sim.interactWithNearest(p); // Flip cover -> magnet snare

      sim.step({ moveX: 1, moveY: 0, aimAngle: 0, buttons: INPUT_BUTTON.DASH }); // Thunder decoy + arm phase blade
      for (let t = 0; t < 15; t++) {
        sim.step({ moveX: 0, moveY: 0, aimAngle: 0, buttons: 0 });
      }
      sim.step({ moveX: 0, moveY: 0, aimAngle: 0, buttons: INPUT_BUTTON.FIRE }); // Consume phase blade
      sim.damageProp(table, 999, 'none'); // Break barricade -> toxic shrapnel

      for (let t = 0; t < 95; t++) {
        sim.step({ moveX: 0, moveY: 0, aimAngle: 0.15, buttons: t % 20 === 0 ? INPUT_BUTTON.FIRE : 0 });
      }

      return JSON.stringify({
        tick: sim.tick,
        rng: sim.rng.getState(),
        px: Number(p.x.toFixed(4)),
        py: Number(p.y.toFixed(4)),
        enemies: sim.enemies.map((e) => ({
          id: e.id,
          hp: e.hp,
          x: Number(e.x.toFixed(4)),
          y: Number(e.y.toFixed(4)),
          poison: e.poisonStacks,
          shock: Number(e.shockTimer.toFixed(4)),
        })),
        projCount: sim.projectiles.length,
        summonCount: sim.summons.length,
      });
    };

    expect(runReplay()).toBe(runReplay());
  });
});
