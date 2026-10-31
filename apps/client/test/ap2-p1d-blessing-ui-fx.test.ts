import {
  ALL_BLESSING_IDS,
  ALL_PHASE1_BLESSING_IDS,
  BLESSINGS,
  type BlessingId,
  WorldSim,
} from '@ashen-pact/shared';
import { describe, expect, it } from 'vitest';
import { TextureBaker } from '../src/art/texture-baker.js';
import {
  drawP1DBlessingActiveOverlays,
  drawP1DBlessingProjectileOverlay,
  isVisualFreezeActive,
  P1D_BLESSING_EVENT_KINDS,
  spawnP1DBlessingEventFx,
} from '../src/fx/combat-fx-blessings-p1d.js';
import {
  drawP4ASummonOverlay,
  drawP4ATetherAndProjectileOverlays,
  handleP4ASimEvent,
} from '../src/fx/combat-fx-p4a.js';
import { getWeaponV2OverlayState } from '../src/fx/combat-fx-weapons-v2.js';
import {
  drawBuffEmblemIcon,
  drawPlayerBlessingChipsHud,
  getBuffVisualMeta,
  resolveLocalizedBuffText,
} from '../src/ui/blessing-card-visuals.js';

function createMockGraphics() {
  const calls: string[] = [];
  return {
    calls,
    clear: () => calls.push('clear'),
    lineStyle: () => calls.push('lineStyle'),
    fillStyle: () => calls.push('fillStyle'),
    beginPath: () => calls.push('beginPath'),
    closePath: () => calls.push('closePath'),
    moveTo: () => calls.push('moveTo'),
    lineTo: () => calls.push('lineTo'),
    strokePath: () => calls.push('strokePath'),
    fillPath: () => calls.push('fillPath'),
    strokeCircle: () => calls.push('strokeCircle'),
    fillCircle: () => calls.push('fillCircle'),
    strokeRoundedRect: () => calls.push('strokeRoundedRect'),
    fillRoundedRect: () => calls.push('fillRoundedRect'),
    fillRect: () => calls.push('fillRect'),
    strokeRect: () => calls.push('strokeRect'),
    fillTriangle: () => calls.push('fillTriangle'),
    strokeTriangle: () => calls.push('strokeTriangle'),
    lineBetween: () => calls.push('lineBetween'),
    arc: () => calls.push('arc'),
    strokeEllipse: () => calls.push('strokeEllipse'),
    fillEllipse: () => calls.push('fillEllipse'),
  };
}

describe('AP2 Phase P1D.4 & P4A.4 — Per-Player Blessing Modal UI, HUD Chips, i18n & Procedural Combat VFX', () => {
  it('resolves localized badge, title, desc, iconKind, and colors for all 34 BLESSINGS in both vi and en with zero raw keys', () => {
    expect(ALL_PHASE1_BLESSING_IDS).toHaveLength(26);
    expect(ALL_BLESSING_IDS).toHaveLength(34);

    for (const id of ALL_BLESSING_IDS) {
      const bDef = BLESSINGS[id]!;
      expect(bDef).toBeDefined();

      const txtVi = resolveLocalizedBuffText(id, 'vi');
      const txtEn = resolveLocalizedBuffText(id, 'en');
      const metaVi = getBuffVisualMeta(id, false);
      const metaEn = getBuffVisualMeta(id, true);

      // Zero raw keys or empty strings
      expect(txtVi.name.length).toBeGreaterThan(2);
      expect(txtVi.desc.length).toBeGreaterThan(10);
      expect(txtVi.name).not.toBe(id);
      expect(txtVi.name).not.toContain('buffs.');
      expect(txtVi.desc).not.toContain('buffs.');

      expect(txtEn.name.length).toBeGreaterThan(2);
      expect(txtEn.desc.length).toBeGreaterThan(10);
      expect(txtEn.name).not.toBe(id);
      expect(txtEn.name).not.toContain('buffs.');
      expect(txtEn.desc).not.toContain('buffs.');

      // Exact Action Category & Element badge format
      expect(metaVi.badgeText).toMatch(/^\[.+\]$/);
      expect(metaEn.badgeText).toMatch(/^\[.+\]$/);
      if (bDef.blessingGroup === 'table_tech') {
        expect(metaVi.badgeText).toContain('CHẮN CHIẾN · ');
        expect(metaEn.badgeText).toContain('TABLE TECH · ');
      } else if (bDef.blessingGroup === 'dash_tech') {
        expect(metaVi.badgeText).toContain('LƯỚT CHIẾN · ');
        expect(metaEn.badgeText).toContain('DASH TECH · ');
      } else if (bDef.blessingGroup === 'reload_tech') {
        expect(metaVi.badgeText).toContain('NHỊP NẠP [R] · ');
        expect(metaEn.badgeText).toContain('RELOAD TECH · ');
      } else if (bDef.blessingGroup === 'bullet_mod') {
        expect(metaVi.badgeText).toContain('ĐẠN ĐẠO · ');
        expect(metaEn.badgeText).toContain('BULLET MOD · ');
      } else if (bDef.blessingGroup === 'skill_upgrade') {
        expect(metaVi.badgeText).toBe('[★ TUYỆT KỸ CLASS]');
        expect(metaEn.badgeText).toBe('[★ SKILL UPGRADE]');
      }

      expect(metaVi.iconKind.length).toBeGreaterThan(0);
      expect(metaVi.borderHex).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(metaVi.accentHex).toBe(bDef.accentColor);
      expect(metaVi.accentColor).toBeGreaterThan(0);
      expect(metaVi.borderColor).toBeGreaterThan(0);
    }
  });

  it('draws procedural vector emblems and top-left HUD blessing chips for all 34 blessings without error', () => {
    const g = createMockGraphics();
    for (const id of ALL_BLESSING_IDS) {
      const meta = getBuffVisualMeta(id, false);
      drawBuffEmblemIcon(g as never, 100, 100, meta.iconKind, meta.accentHex);
      drawBuffEmblemIcon(g as never, meta.iconKind, 100, 100, meta.accentHex);
    }
    expect(g.calls.includes('fillCircle')).toBe(true);
    expect(g.calls.includes('strokeCircle')).toBe(true);

    const hudG = createMockGraphics();
    const drawnEmpty = drawPlayerBlessingChipsHud({}, hudG as never, { blessingIds: [] }, 12, 85);
    expect(drawnEmpty).toBe(0);

    const drawnOwned = drawPlayerBlessingChipsHud(
      {},
      hudG as never,
      {
        blessingIds: [
          'table_tech_rocket',
          'dash_reload_acrobat',
          'reload_tediore_chuck',
          'bullet_split_bounce',
          'vanguard_bastion_prism',
        ] as BlessingId[],
      },
      12,
      85,
    );
    expect(drawnOwned).toBe(5);
    expect(hudG.calls.length).toBeGreaterThan(10);
  });

  it('renders active P1D world/prop/zone/deployable overlays, projectile overlays, and all 18 P1D event VFX deterministically', () => {
    const sim = new WorldSim({ seed: 9401, startInHub: false });
    const g = createMockGraphics();
    const mockScene = {
      sim,
      telegraphGraphics: g,
      camFocusX: 300,
      camFocusY: 300,
      visualFreeze: true,
    };

    expect(isVisualFreezeActive(mockScene)).toBe(true);

    // 1. Flipped prism barricade + rocket-charged sliding barricade
    const prismCover = sim.spawnProp('moss_table', 260, 240);
    prismCover.coverState = 'flipped';
    prismCover.prismAuraActive = true;

    const rocketCover = sim.spawnProp('forge_blast_shield', 340, 240);
    rocketCover.coverState = 'sliding';
    rocketCover.rocketCharged = true;
    rocketCover.bouncesRemaining = 2;
    rocketCover.vx = 620;
    rocketCover.vy = 0;

    // 2. Skill zones (elementalist_twin_orbit, sacredGroveAura, isVenomWake, reload_magnet_vortex)
    sim.skillZones.push(
      {
        id: 501,
        ownerPlayerId: sim.player.id,
        x: 240,
        y: 300,
        radius: 76,
        ttlSec: 4,
        maxTtlSec: 5,
        tickTimer: 0.4,
        element: 'burn',
        secondaryElement: 'chill',
        vortex: true,
        linkedZoneId: 502,
      },
      {
        id: 502,
        ownerPlayerId: sim.player.id,
        x: 400,
        y: 300,
        radius: 76,
        ttlSec: 4,
        maxTtlSec: 5,
        tickTimer: 0.4,
        element: 'chill',
        secondaryElement: 'none',
        vortex: true,
        linkedZoneId: 501,
        isTwinSecondary: true,
      },
    );

    // 3. Twin Tesla Turrets & Sacred Grove Tree
    sim.summons.push(
      {
        id: 601,
        ownerPlayerId: sim.player.id,
        kind: 'tesla_turret',
        nameVi: 'Trụ Tesla 1',
        x: 240,
        y: 180,
        radius: 15,
        auraRadius: 195,
        hp: 45,
        maxHp: 45,
        ttlSec: 8,
        maxTtlSec: 10,
        tickTimer: 0.3,
        healsRemaining: 0,
        charge: 50,
        poisonRoots: false,
        selfDestruct: true,
        rootedEnemyIds: [],
      },
      {
        id: 602,
        ownerPlayerId: sim.player.id,
        kind: 'tesla_turret',
        nameVi: 'Trụ Tesla 2',
        x: 380,
        y: 180,
        radius: 15,
        auraRadius: 195,
        hp: 45,
        maxHp: 45,
        ttlSec: 8,
        maxTtlSec: 10,
        tickTimer: 0.3,
        healsRemaining: 0,
        charge: 80,
        poisonRoots: false,
        selfDestruct: true,
        rootedEnemyIds: [],
      },
      {
        id: 603,
        ownerPlayerId: sim.player.id,
        kind: 'sacred_tree',
        nameVi: 'Cây Thiêng',
        x: 320,
        y: 360,
        radius: 15,
        auraRadius: 105,
        hp: 36,
        maxHp: 36,
        ttlSec: 5,
        maxTtlSec: 6,
        tickTimer: 1.2,
        healsRemaining: 2,
        charge: 0,
        poisonRoots: true,
        sacredGrove: true,
        selfDestruct: false,
        rootedEnemyIds: [],
      },
    );

    // 4. Vanguard Bastion Prism active shield & dashing player
    sim.player.characterId = 'vanguard';
    sim.player.skillActiveTimer = 3.0;
    sim.player.dashTimer = 0.14;
    sim.player.blessingIds = [...ALL_PHASE1_BLESSING_IDS];

    drawP1DBlessingActiveOverlays(mockScene as never, sim, 1.5);
    expect(g.calls.includes('strokeCircle')).toBe(true);
    expect(g.calls.includes('strokePath')).toBe(true);

    // 5. Projectile overlays (table_tech_rocket, reload_tediore_chuck, splitGeneration === 1)
    const projG = createMockGraphics();
    for (const weaponId of ['table_tech_rocket', 'reload_tediore_chuck', 'rivet_gun']) {
      drawP1DBlessingProjectileOverlay(
        mockScene as never,
        projG as never,
        {
          id: 701,
          ownerId: sim.player.id,
          team: 'player',
          weaponId,
          prevX: 280,
          prevY: 240,
          x: 300,
          y: 240,
          vx: 520,
          vy: 0,
          angle: 0,
          radius: 6,
          damage: 26,
          isCrit: false,
          knockback: 150,
          pierceRemaining: 0,
          bounceRemaining: 1,
          ttlSec: 1.0,
          element: 'burn',
          amplifiedByShield: false,
          splitGeneration: weaponId === 'rivet_gun' ? 1 : 0,
          hitEntityIds: [],
        },
        1.25,
      );
    }
    expect(projG.calls.length).toBeGreaterThan(10);

    // 6. All 18 P1D blessing event kinds
    expect(P1D_BLESSING_EVENT_KINDS).toHaveLength(18);
    for (const kind of P1D_BLESSING_EVENT_KINDS) {
      spawnP1DBlessingEventFx(
        mockScene as never,
        {
          kind,
          x: 320,
          y: 260,
          x2: 400,
          y2: 260,
          radius: 110,
          angle: 0.25,
        } as never,
        sim,
        false,
        false,
      );
    }

    const overlayState = getWeaponV2OverlayState(mockScene);
    expect(overlayState.shapes.length).toBeGreaterThan(0);
  });

  it('maps caustic_spore_pod prop texture and renders all Phase P4A summon, tether, projectile, and acid overlays deterministically', () => {
    expect(TextureBaker.getPropTextureKey('caustic_spore_pod')).toBe('prop_volatile_spore_pod');

    const sim = new WorldSim({ seed: 9404, startInHub: false });
    sim.tick = 120;
    sim.player.x = 340;
    sim.player.y = 270;
    sim.player.aimAngle = 0;
    sim.player.aimWorldX = 480;
    sim.player.aimWorldY = 270;
    sim.player.blessingIds = [
      'dash_thunder_decoy',
      'dash_phase_blade',
      'reload_caustic_pod',
      'reload_holster_surge',
      'bullet_wall_tether',
      'bullet_orbit_return',
    ];

    const mockScene = {
      sim,
      camFocusX: 340,
      camFocusY: 270,
      visualFreeze: true,
    };

    // 1. P4A Summons: thunder_decoy, wall_tether_pylon (x2), holo_decoy_turret
    const thunderDecoy = {
      id: 801,
      ownerPlayerId: sim.player.id,
      kind: 'thunder_decoy' as const,
      nameVi: 'Tượng Bóng Sét',
      x: 320,
      y: 260,
      radius: 16,
      auraRadius: 220,
      hp: 999,
      maxHp: 999,
      ttlSec: 1.2,
      maxTtlSec: 1.5,
      tickTimer: 1.2,
      healsRemaining: 0,
      charge: 0,
      poisonRoots: false,
      selfDestruct: false,
      rootedEnemyIds: [],
    };
    const pylon1 = {
      ...thunderDecoy,
      id: 802,
      kind: 'wall_tether_pylon' as const,
      nameVi: 'Cọc Điện Cao Thế 1',
      x: 420,
      y: 196,
      radius: 10,
      auraRadius: 360,
      ttlSec: 3.8,
      maxTtlSec: 4.5,
    };
    const pylon2 = {
      ...pylon1,
      id: 803,
      nameVi: 'Cọc Điện Cao Thế 2',
      x: 420,
      y: 344,
    };
    const holoDecoy = {
      ...thunderDecoy,
      id: 804,
      kind: 'holo_decoy_turret' as const,
      nameVi: 'Bóng Pháo Ảnh',
      x: 340,
      y: 310,
      radius: 14,
      auraRadius: 340,
      ttlSec: 2.8,
      maxTtlSec: 3.5,
      tickTimer: 0.04,
    };
    const nonP4ASummon = {
      ...thunderDecoy,
      id: 805,
      kind: 'tesla_turret' as const,
    };

    sim.summons.push(thunderDecoy, pylon1, pylon2, holoDecoy);

    for (const s of [thunderDecoy, pylon1, holoDecoy]) {
      const sg = createMockGraphics();
      const handled = drawP4ASummonOverlay(mockScene as never, sg as never, sim, s);
      expect(handled).toBe(true);
      expect(sg.calls.includes('fillCircle')).toBe(true);
      expect(sg.calls.includes('strokeCircle') || sg.calls.includes('strokePath')).toBe(true);
    }
    const ignoredG = createMockGraphics();
    expect(drawP4ASummonOverlay(mockScene as never, ignoredG as never, sim, nonP4ASummon)).toBe(false);
    expect(ignoredG.calls).toHaveLength(0);

    // 2. Enemy intersecting Electric Cutter Wire + caustic_spore_pod prop + P4A projectiles
    const wireEnemy = sim.spawnEnemy('goblin_shooter', 420, 270, true);
    wireEnemy.hp = 200;
    wireEnemy.maxHp = 200;

    const causticPod = sim.spawnProp('caustic_spore_pod', 385, 250);
    causticPod.hp = 1;

    const baseProj = {
      id: 901,
      ownerId: sim.player.id,
      team: 'player' as const,
      weaponId: 'rivet_gun',
      prevX: 460,
      prevY: 270,
      x: 440,
      y: 270,
      vx: -480,
      vy: 0,
      angle: Math.PI,
      radius: 6,
      damage: 20,
      isCrit: false,
      knockback: 100,
      pierceRemaining: 1,
      bounceRemaining: 0,
      ttlSec: 0.6,
      element: 'poison' as const,
      amplifiedByShield: false,
      hitEntityIds: [] as number[],
    };

    sim.projectiles.push(
      { ...baseProj, id: 901, orbitReturned: true },
      { ...baseProj, id: 902, weaponId: 'dash_phase_blade', element: 'none', radius: 18, angle: 0, vx: 560 },
      { ...baseProj, id: 903, weaponId: 'mutator_boomerang_saw', element: 'shock', radius: 16, angle: 0, vx: 500 },
      { ...baseProj, id: 904, weaponId: 'frag_launcher', element: 'burn', clusterMortarLob: true, originX: 340, originY: 270, x: 410, y: 270 },
      { ...baseProj, id: 905, weaponId: 'holster_surge_bolt', element: 'shock', radius: 10, angle: 0, vx: 820 },
      { ...baseProj, id: 906, weaponId: 'holo_decoy_shot', element: 'shock', radius: 5, angle: 0, vx: 560 },
    );

    handleP4ASimEvent(
      mockScene as never,
      {
        kind: 'explosion',
        x: 320,
        y: 260,
        radius: 88,
        damage: 36,
        sourceDefId: 'dash_thunder_decoy',
      },
      sim,
      false,
      false,
    );

    const gPass1 = createMockGraphics();
    const gPass2 = createMockGraphics();
    drawP4ATetherAndProjectileOverlays(mockScene as never, gPass1 as never, sim);
    drawP4ATetherAndProjectileOverlays(mockScene as never, gPass2 as never, sim);

    expect(gPass1.calls.length).toBeGreaterThan(40);
    expect(gPass1.calls.includes('strokePath')).toBe(true);
    expect(gPass1.calls.includes('fillEllipse')).toBe(true);
    expect(gPass1.calls).toEqual(gPass2.calls);
  });
});
