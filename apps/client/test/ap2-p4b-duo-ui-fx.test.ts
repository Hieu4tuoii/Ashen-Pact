import {
  ALL_DUO_BOON_IDS,
  DUO_BOONS,
  type BlessingId,
  type DuoBoonId,
  type ElementType,
  WorldSim,
} from '@ashen-pact/shared';
import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    GameObjects: { Container: class {} },
    BlendModes: { ADD: 1 },
    Renderer: { WebGL: { Pipelines: { PostFXPipeline: class {} } } },
  },
}));
vi.mock('../src/scenes/GameScene.js', () => ({ RIG_FOOT_OFFSET_Y: 14 }));

import { PALETTE } from '../src/art/palette.js';
import { TextureBaker } from '../src/art/texture-baker.js';
import { zzfx } from '../src/audio/zzfx.js';
import '../src/fx/combat-fx-weapons-v2.js';
import {
  drawP4BSummonOverlay,
  handleP4BSimEvent,
  renderP4BDuoAndSecretArenaOverlays,
} from '../src/fx/combat-fx-p4b.js';
import { resolveInteractableVisualGlowSpec } from '../src/fx/lighting-config.js';
import { updateTopCenterBannersAndQolImpl } from '../src/scenes/game-scene/hud-qol-and-minimap.js';
import { resolveInteractPromptSpec } from '../src/scenes/game-scene/interact-prompt.js';
import { processSimEventsImpl } from '../src/scenes/game-scene/sim-events.js';
import {
  drawDuoBoonIntersectingEmblems,
  drawPlayerBlessingChipsHud,
  getBuffVisualMeta,
  resolveLocalizedBuffText,
} from '../src/ui/blessing-card-visuals.js';
import { buildSecretArenaHudViewModel } from '../src/ui/secret-arena-hud.js';

function createMockGraphics() {
  const calls: string[] = [];
  const fillColors: number[] = [];
  const fillAlphas: number[] = [];
  const lineColors: number[] = [];
  const lineAlphas: number[] = [];
  const circleRadii: number[] = [];
  return {
    calls,
    fillColors,
    fillAlphas,
    lineColors,
    lineAlphas,
    circleRadii,
    clear: () => calls.push('clear'),
    setBlendMode: (mode?: unknown) => calls.push(`blend:${String(mode)}`),
    setDepth: (d?: number) => calls.push(`depth:${String(d)}`),
    lineStyle: (_w?: number, col?: number, alpha = 1) => {
      calls.push('lineStyle');
      if (typeof col === 'number') lineColors.push(col);
      lineAlphas.push(alpha);
    },
    fillStyle: (col?: number, alpha = 1) => {
      calls.push('fillStyle');
      if (typeof col === 'number') fillColors.push(col);
      fillAlphas.push(alpha);
    },
    beginPath: () => calls.push('beginPath'),
    closePath: () => calls.push('closePath'),
    moveTo: () => calls.push('moveTo'),
    lineTo: () => calls.push('lineTo'),
    strokePath: () => calls.push('strokePath'),
    fillPath: () => calls.push('fillPath'),
    strokeCircle: (_x?: number, _y?: number, r?: number) => {
      calls.push('strokeCircle');
      if (typeof r === 'number') circleRadii.push(r);
    },
    fillCircle: (_x?: number, _y?: number, r?: number) => {
      calls.push('fillCircle');
      if (typeof r === 'number') circleRadii.push(r);
    },
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

const ELEMENT_LABEL_VI: Record<ElementType, string> = {
  burn: 'LỬA',
  chill: 'BĂNG',
  shock: 'SÉT',
  poison: 'ĐỘC',
  none: 'VẬT LÝ',
};

const ELEMENT_LABEL_EN: Record<ElementType, string> = {
  burn: 'BURN',
  chill: 'CHILL',
  shock: 'SHOCK',
  poison: 'POISON',
  none: 'PHYSICAL',
};

describe('AP2 Phase P4B.3 — Duo Boon Diamond-Rainbow UI, 20s Secret Arena HUD & Procedural VFX', () => {
  it('resolves getBuffVisualMeta and resolveLocalizedBuffText for all 6 DuoBoonIds in both vi and en with zero snake_case leaks', () => {
    expect(ALL_DUO_BOON_IDS).toHaveLength(6);

    for (const id of ALL_DUO_BOON_IDS) {
      const duoDef = DUO_BOONS[id];
      expect(duoDef).toBeDefined();

      const txtVi = resolveLocalizedBuffText(id, 'vi');
      const txtEn = resolveLocalizedBuffText(id, 'en');
      const metaVi = getBuffVisualMeta(id, false);
      const metaEn = getBuffVisualMeta(id, true);

      // Localized strings must be rich, diacritic-preserving, and never raw keys or snake_case
      expect(txtVi.name.length).toBeGreaterThan(3);
      expect(txtVi.desc.length).toBeGreaterThan(15);
      expect(txtVi.name).not.toBe(id);
      expect(txtVi.name).not.toContain('_');
      expect(txtVi.desc).not.toContain('buffs.');

      expect(txtEn.name.length).toBeGreaterThan(3);
      expect(txtEn.desc.length).toBeGreaterThan(15);
      expect(txtEn.name).not.toBe(id);
      expect(txtEn.name).not.toContain('_');
      expect(txtEn.desc).not.toContain('buffs.');

      // Duo Boon visual metadata contract
      expect(metaVi.isDuoBoon).toBe(true);
      expect(metaEn.isDuoBoon).toBe(true);
      expect(metaVi.requiredElements).toEqual(duoDef.requiredElements);
      expect(metaEn.requiredElements).toEqual(duoDef.requiredElements);
      expect(metaVi.borderHex).toBe(duoDef.primaryColor);
      expect(metaVi.secondaryHex).toBe(duoDef.secondaryColor);
      expect(metaVi.borderColor).toBeGreaterThan(0);
      expect(metaVi.secondaryColor).toBeGreaterThan(0);

      const [elA, elB] = duoDef.requiredElements;
      expect(metaVi.badgeText).toContain('GIAO THOA');
      expect(metaVi.badgeText).toContain(ELEMENT_LABEL_VI[elA]);
      expect(metaVi.badgeText).toContain(ELEMENT_LABEL_VI[elB]);

      expect(metaEn.badgeText).toContain('DUO BOON');
      expect(metaEn.badgeText).toContain(ELEMENT_LABEL_EN[elA]);
      expect(metaEn.badgeText).toContain(ELEMENT_LABEL_EN[elB]);
    }
  });

  it('draws intersecting elemental emblems for all 6 Duo Boons and includes Duo Boons in top-left HUD chips', () => {
    for (const id of ALL_DUO_BOON_IDS) {
      const meta = getBuffVisualMeta(id, false);
      const g = createMockGraphics();
      const [elA, elB] = meta.requiredElements!;
      drawDuoBoonIntersectingEmblems(
        g as never,
        120,
        64,
        elA,
        elB,
        meta.borderColor,
        meta.secondaryColor!,
      );
      // Must draw at least 2 intersecting rings + per-element vector glyphs + central diamond fusion spark
      const strokeCircles = g.calls.filter((c) => c === 'strokeCircle').length;
      expect(strokeCircles).toBeGreaterThanOrEqual(2);
      expect(g.calls.includes('fillTriangle')).toBe(true);
      expect(g.lineColors).toContain(meta.borderColor);
      expect(g.lineColors).toContain(meta.secondaryColor!);
    }

    const hudG = createMockGraphics();
    const chipCount = drawPlayerBlessingChipsHud(
      {},
      hudG as never,
      {
        blessingIds: ['table_tech_rocket', 'dash_reload_acrobat'] as BlessingId[],
        duoBoonIds: ['duo_superheated_cyclone', 'duo_plasma_overload_star'] as DuoBoonId[],
      },
      12,
      85,
    );
    expect(chipCount).toBe(4);
    expect(hudG.calls.length).toBeGreaterThan(15);
  });

  it('builds Secret Arena 20s countdown HUD view models across idle, active 16.4s, urgent 3.2s, victory +40 Gold, and safe expired states', () => {
    // 1. Idle -> null
    expect(
      buildSecretArenaHudViewModel(
        {
          secretTrialActive: false,
          secretTrialTimer: 0,
          secretTrialResult: 'idle',
          secretTrialBannerTimer: 0,
          secretTrialRemainingEnemies: 0,
        },
        'vi',
      ),
    ).toBeNull();

    // 2. Active at 16.4s (>= 5.0s normal gold-violet state)
    const activeVi = buildSecretArenaHudViewModel(
      {
        secretTrialActive: true,
        secretTrialTimer: 16.4,
        secretTrialResult: 'active',
        secretTrialBannerTimer: 0,
        secretTrialRemainingEnemies: 5,
      },
      'vi',
    );
    const activeEn = buildSecretArenaHudViewModel(
      {
        secretTrialActive: true,
        secretTrialTimer: 16.4,
        secretTrialResult: 'active',
        secretTrialBannerTimer: 0,
        secretTrialRemainingEnemies: 5,
      },
      'en',
    );
    expect(activeVi).not.toBeNull();
    expect(activeEn).not.toBeNull();
    expect(activeVi!.mode).toBe('active');
    expect(activeVi!.isUrgent).toBe(false);
    expect(activeVi!.progressRatio).toBeCloseTo(16.4 / 20, 3);
    expect(activeVi!.primaryText).toContain('16.4');
    expect(activeVi!.primaryText).toContain('5');
    expect(activeVi!.primaryText).not.toContain('ui.hud.');
    expect(activeEn!.primaryText).toContain('16.4');
    expect(activeEn!.primaryText).toContain('5');
    expect(activeEn!.primaryText).not.toContain('ui.hud.');

    // 3. Urgent warning state at 3.2s (< 5.0s orange-red transition)
    const urgentVi = buildSecretArenaHudViewModel(
      {
        secretTrialActive: true,
        secretTrialTimer: 3.2,
        secretTrialResult: 'active',
        secretTrialBannerTimer: 0,
        secretTrialRemainingEnemies: 2,
      },
      'vi',
    );
    const urgentEn = buildSecretArenaHudViewModel(
      {
        secretTrialActive: true,
        secretTrialTimer: 3.2,
        secretTrialResult: 'active',
        secretTrialBannerTimer: 0,
        secretTrialRemainingEnemies: 2,
      },
      'en',
    );
    expect(urgentVi).not.toBeNull();
    expect(urgentVi!.mode).toBe('active');
    expect(urgentVi!.isUrgent).toBe(true);
    expect(urgentVi!.barColorHex).not.toBe(activeVi!.barColorHex);
    expect(urgentVi!.primaryText).toContain('3.2');
    expect(urgentEn!.primaryText).toContain('3.2');

    // 4. Victory banner (+40 Gold & Legendary Chest Ascension)
    const victoryVi = buildSecretArenaHudViewModel(
      {
        secretTrialActive: false,
        secretTrialTimer: 7.1,
        secretTrialResult: 'victory',
        secretTrialBannerTimer: 3.5,
        secretTrialRemainingEnemies: 0,
      },
      'vi',
    );
    const victoryEn = buildSecretArenaHudViewModel(
      {
        secretTrialActive: false,
        secretTrialTimer: 7.1,
        secretTrialResult: 'victory',
        secretTrialBannerTimer: 3.5,
        secretTrialRemainingEnemies: 0,
      },
      'en',
    );
    expect(victoryVi).not.toBeNull();
    expect(victoryVi!.mode).toBe('victory');
    expect(victoryVi!.primaryText).toContain('+40');
    expect(victoryVi!.primaryText.toUpperCase()).toContain('HUYỀN THOẠI');
    expect(victoryEn!.mode).toBe('victory');
    expect(victoryEn!.primaryText).toContain('+40');
    expect(victoryEn!.primaryText.toUpperCase()).toContain('LEGENDARY');

    // 5. Safe Expired banner (non-punitive)
    const expiredVi = buildSecretArenaHudViewModel(
      {
        secretTrialActive: false,
        secretTrialTimer: 0,
        secretTrialResult: 'expired',
        secretTrialBannerTimer: 2.4,
        secretTrialRemainingEnemies: 0,
      },
      'vi',
    );
    const expiredEn = buildSecretArenaHudViewModel(
      {
        secretTrialActive: false,
        secretTrialTimer: 0,
        secretTrialResult: 'expired',
        secretTrialBannerTimer: 2.4,
        secretTrialRemainingEnemies: 0,
      },
      'en',
    );
    expect(expiredVi).not.toBeNull();
    expect(expiredVi!.mode).toBe('expired');
    expect(expiredVi!.primaryText.length).toBeGreaterThan(10);
    expect(expiredVi!.primaryText).not.toContain('ui.hud.');
    expect(expiredEn!.mode).toBe('expired');
    expect(expiredEn!.primaryText.length).toBeGreaterThan(10);
    expect(expiredEn!.primaryText).not.toContain('ui.hud.');
  });

  it('renders all 6 Duo Boon overlays + secret_challenge_crystal deterministically under visualFreeze and enforces 0.50 remote teammate alpha', () => {
    const sim = new WorldSim({ seed: 9411, startInHub: false });
    sim.enemies.length = 0;
    sim.props.length = 0;
    sim.projectiles.length = 0;
    sim.summons.length = 0;
    sim.npcEntities.length = 0;
    sim.tick = 180;
    sim.player.duoBoonIds = [...ALL_DUO_BOON_IDS];

    // 1. duo_superheated_cyclone summon
    const cyclone = {
      id: 1101,
      ownerPlayerId: sim.player.id,
      kind: 'superheated_cyclone' as const,
      nameVi: 'Lốc Xoáy Nước Sôi',
      x: 250,
      y: 210,
      radius: 18,
      auraRadius: 56,
      hp: 999,
      maxHp: 999,
      ttlSec: 3.2,
      maxTtlSec: 4.0,
      tickTimer: 0.2,
      healsRemaining: 0,
      charge: 0,
      poisonRoots: false,
      selfDestruct: false,
      rootedEnemyIds: [],
    };
    sim.summons.push(cyclone);

    const summonG = createMockGraphics();
    expect(
      drawP4BSummonOverlay({ sim, visualFreeze: true } as never, summonG as never, sim, cyclone),
    ).toBe(true);
    expect(summonG.calls.length).toBeGreaterThan(4);

    // 2. duo_cryo_shatter_spires glacial_spike prop
    const cryoSpire = sim.spawnProp('glacial_spike', 310, 220);
    cryoSpire.cryoShatterSpire = true;
    cryoSpire.ownerPlayerId = sim.player.id;
    cryoSpire.ttlSec = 3.4;

    // 3 & 4. Enemy with superconductTimer > 0 (r=100px magnetic field) AND napalmPlagueTimer > 0
    const afflictedEnemy = sim.spawnEnemy('goblin_shooter', 380, 260, true);
    afflictedEnemy.hp = 180;
    afflictedEnemy.maxHp = 180;
    afflictedEnemy.superconductTimer = 2.5;
    afflictedEnemy.napalmPlagueTimer = 3.0;
    afflictedEnemy.napalmPlagueOwnerId = sim.player.id;

    // 3b & 5. Redirected superconduct rail projectile + duo_plasma_overload_star projectile
    const baseProj = {
      id: 1201,
      ownerId: sim.player.id,
      team: 'player' as const,
      weaponId: 'rivet_gun',
      prevX: 330,
      prevY: 260,
      x: 350,
      y: 260,
      vx: 540,
      vy: 0,
      angle: 0,
      radius: 5,
      damage: 24,
      isCrit: false,
      knockback: 80,
      pierceRemaining: 0,
      bounceRemaining: 0,
      ttlSec: 0.8,
      element: 'shock' as const,
      amplifiedByShield: false,
      hitEntityIds: [] as number[],
    };
    sim.projectiles.push(
      { ...baseProj, id: 1201, superconductRailRedirected: true },
      {
        ...baseProj,
        id: 1202,
        weaponId: 'duo_plasma_overload_star',
        x: 420,
        y: 210,
        prevX: 404,
        prevY: 210,
        radius: 8,
        bounceRemaining: 2,
        bouncesDone: 1,
        element: 'burn',
      },
    );

    // 6. duo_magnetic_bastion_ring: 2 flipped barricades within <= 220px
    const coverA = sim.spawnProp('forge_blast_shield', 280, 320);
    coverA.coverState = 'flipped';
    coverA.flippedByPlayerId = sim.player.id;
    const coverB = sim.spawnProp('moss_table', 440, 320);
    coverB.coverState = 'flipped';
    coverB.flippedByPlayerId = sim.player.id;

    // 7. Active secret_challenge_crystal NPC
    sim.npcEntities.push({
      id: 1301,
      kind: 'secret_challenge_crystal',
      nameVi: 'Tinh Thể Khiêu Chiến',
      dialogueVi: '',
      x: 480,
      y: 180,
      radius: 20,
      interacted: false,
      costHp: 0,
    });

    const gPass1 = createMockGraphics();
    const gPass2 = createMockGraphics();
    renderP4BDuoAndSecretArenaOverlays({
      sim,
      telegraphGraphics: gPass1,
      visualFreeze: true,
    } as never);
    renderP4BDuoAndSecretArenaOverlays({
      sim,
      telegraphGraphics: gPass2,
      visualFreeze: true,
    } as never);

    expect(gPass1.calls.length).toBeGreaterThan(50);
    // Deterministic freeze guarantee: two consecutive passes produce 100% identical draw calls
    expect(gPass1.calls).toEqual(gPass2.calls);
    // Superconduct rail r=100px ring must be drawn
    expect(gPass1.circleRadii.some((r) => Math.abs(r - 100) <= 2)).toBe(true);
    // Enemy bullet red (#E84545) must never be used as an opaque fill/stroke in Duo Boon overlays
    expect(gPass1.fillColors).not.toContain(0xe84545);

    // Verify remote teammate 0.50 alpha scaling for duo_magnetic_bastion_ring
    const remoteSim = new WorldSim({ seed: 9412, startInHub: false });
    remoteSim.enemies.length = 0;
    remoteSim.props.length = 0;
    remoteSim.projectiles.length = 0;
    remoteSim.summons.length = 0;
    remoteSim.npcEntities.length = 0;
    remoteSim.tick = 180;
    remoteSim.player.duoBoonIds = [];
    const ally = {
      ...remoteSim.player,
      id: 2,
      slot: 2 as const,
      duoBoonIds: ['duo_magnetic_bastion_ring'] as DuoBoonId[],
    };
    remoteSim.simulatedPlayers.push(ally);

    const allyCoverA = remoteSim.spawnProp('glacial_barricade', 260, 300);
    allyCoverA.coverState = 'flipped';
    allyCoverA.flippedByPlayerId = ally.id;
    const allyCoverB = remoteSim.spawnProp('glacial_barricade', 400, 300);
    allyCoverB.coverState = 'flipped';
    allyCoverB.flippedByPlayerId = ally.id;

    const localSimOnly = new WorldSim({ seed: 9412, startInHub: false });
    localSimOnly.enemies.length = 0;
    localSimOnly.props.length = 0;
    localSimOnly.projectiles.length = 0;
    localSimOnly.summons.length = 0;
    localSimOnly.npcEntities.length = 0;
    localSimOnly.tick = 180;
    localSimOnly.player.duoBoonIds = ['duo_magnetic_bastion_ring'];
    const locCoverA = localSimOnly.spawnProp('glacial_barricade', 260, 300);
    locCoverA.coverState = 'flipped';
    locCoverA.flippedByPlayerId = localSimOnly.player.id;
    const locCoverB = localSimOnly.spawnProp('glacial_barricade', 400, 300);
    locCoverB.coverState = 'flipped';
    locCoverB.flippedByPlayerId = localSimOnly.player.id;

    const gLocalBastion = createMockGraphics();
    const gRemoteBastion = createMockGraphics();
    renderP4BDuoAndSecretArenaOverlays({
      sim: localSimOnly,
      telegraphGraphics: gLocalBastion,
      visualFreeze: true,
    } as never);
    renderP4BDuoAndSecretArenaOverlays({
      sim: remoteSim,
      telegraphGraphics: gRemoteBastion,
      visualFreeze: true,
    } as never);

    expect(gLocalBastion.lineAlphas.length).toBeGreaterThan(0);
    expect(gRemoteBastion.lineAlphas.length).toBe(gLocalBastion.lineAlphas.length);
    for (let i = 0; i < gLocalBastion.lineAlphas.length; i++) {
      expect(gRemoteBastion.lineAlphas[i]).toBeCloseTo(gLocalBastion.lineAlphas[i]! * 0.5, 4);
    }
  });

  it('handles duo_cryo_shatter_spire, duo_napalm_chain_plague, secret_trial_started, and secret_trial_resolved events with strict roomId filtering', () => {
    const sim = new WorldSim({ seed: 9413, startInHub: false });
    sim.enemies.length = 0;
    sim.props.length = 0;
    sim.projectiles.length = 0;
    sim.summons.length = 0;
    sim.npcEntities.length = 0;
    sim.tick = 300;
    const activeRoomId = sim.currentRoomId;
    const mockScene = { sim, telegraphGraphics: createMockGraphics(), visualFreeze: true };

    // Events from a DIFFERENT roomId must be safely ignored
    handleP4BSimEvent(mockScene as never, {
      kind: 'secret_trial_started',
      roomId: activeRoomId + 99,
      durationSec: 20,
      x: 320,
      y: 240,
    });
    handleP4BSimEvent(mockScene as never, {
      kind: 'secret_trial_resolved',
      roomId: activeRoomId + 99,
      victory: true,
      bonusGold: 40,
      x: 320,
      y: 240,
    });
    const gIgnored = createMockGraphics();
    renderP4BDuoAndSecretArenaOverlays({
      sim,
      telegraphGraphics: gIgnored,
      visualFreeze: true,
    } as never);
    expect(gIgnored.calls).toHaveLength(0);

    // Events in the CURRENT room must spawn deterministic transient bursts
    handleP4BSimEvent(mockScene as never, {
      kind: 'explosion',
      x: 260,
      y: 220,
      radius: 80,
      damage: 42,
      sourceDefId: 'duo_cryo_shatter_spire',
    });
    handleP4BSimEvent(mockScene as never, {
      kind: 'explosion',
      x: 340,
      y: 260,
      radius: 110,
      damage: 48,
      sourceDefId: 'duo_napalm_chain_plague',
    });
    handleP4BSimEvent(mockScene as never, {
      kind: 'secret_trial_started',
      roomId: activeRoomId,
      durationSec: 20,
      x: 400,
      y: 200,
    });
    handleP4BSimEvent(mockScene as never, {
      kind: 'secret_trial_resolved',
      roomId: activeRoomId,
      victory: true,
      bonusGold: 40,
      x: 400,
      y: 200,
    });

    sim.tick = 304;
    const gActive = createMockGraphics();
    renderP4BDuoAndSecretArenaOverlays({
      sim,
      telegraphGraphics: gActive,
      visualFreeze: true,
    } as never);
    expect(gActive.calls.includes('strokeCircle')).toBe(true);
    expect(gActive.calls.includes('lineBetween') || gActive.calls.includes('strokePath')).toBe(
      true,
    );

    // Changing currentRoomId immediately purges stale bursts from the previous room
    sim.currentRoomId = activeRoomId + 1;
    const gAfterRoomChange = createMockGraphics();
    renderP4BDuoAndSecretArenaOverlays({
      sim,
      telegraphGraphics: gAfterRoomChange,
      visualFreeze: true,
    } as never);
    expect(gAfterRoomChange.calls).toHaveLength(0);
  });

  it('resolves secret_challenge_crystal texture keys, radial glow specs, and localized [E] interact prompts in vi and en', () => {
    expect(TextureBaker.getSecretChallengeCrystalTextureKey(false)).toBe(
      'prop_secret_challenge_crystal',
    );
    expect(TextureBaker.getSecretChallengeCrystalTextureKey(true)).toBe(
      'prop_secret_challenge_crystal_used',
    );

    const activeGlow = resolveInteractableVisualGlowSpec({
      kind: 'secret_challenge_crystal',
      interacted: false,
      elapsedSec: 1.2,
    });
    const dormantGlow = resolveInteractableVisualGlowSpec({
      kind: 'secret_challenge_crystal',
      interacted: true,
      elapsedSec: 1.2,
    });
    expect(activeGlow.glowAlpha).toBeGreaterThan(0);
    expect(activeGlow.colorNum).toBe(0xa855f7);
    expect(dormantGlow.glowAlpha).toBe(0);

    const sim = new WorldSim({ seed: 9414, startInHub: false });
    const crystalNpc = {
      id: 1401,
      kind: 'secret_challenge_crystal' as const,
      nameVi: 'Tinh Thể Khiêu Chiến',
      dialogueVi: '',
      x: 320,
      y: 220,
      radius: 20,
      interacted: false,
      costHp: 0,
    };
    const promptVi = resolveInteractPromptSpec(
      sim,
      {
        kind: 'secret_challenge_crystal',
        key: 'npc:1401',
        x: 320,
        y: 220,
        dist: 18,
        npc: crystalNpc,
      },
      { locale: 'vi' },
    );
    const promptEn = resolveInteractPromptSpec(
      sim,
      {
        kind: 'secret_challenge_crystal',
        key: 'npc:1401',
        x: 320,
        y: 220,
        dist: 18,
        npc: crystalNpc,
      },
      { locale: 'en' },
    );
    expect(promptVi).not.toBeNull();
    expect(promptEn).not.toBeNull();
    expect(promptVi!.keycapText).toBe('E');
    expect(promptVi!.titleText).toContain('Tinh Thể Khiêu Chiến');
    expect(promptVi!.titleText).not.toContain('ui.interact');
    expect(promptEn!.titleText).toContain('20s Trial Crystal');
    expect(promptEn!.titleText).not.toContain('ui.interact');
  });

  it('offsets top-center reactionBanner below the 20s Secret Arena countdown HUD panel (Y=58) when no boss is active', () => {
    const sim = new WorldSim({ seed: 9415, startInHub: false });
    let rxTextY = -1;
    const reactionBannerText = {
      text: '',
      width: 150,
      visible: false,
      style: { color: '' },
      setText(t: string) {
        this.text = t;
      },
      setColor(c: string) {
        this.style.color = c;
      },
      setPosition(_x: number, y: number) {
        rxTextY = y;
      },
      setAlpha() {},
      setVisible(v: boolean) {
        this.visible = v;
      },
    };
    const mockScene = {
      transport: { getSim: () => sim },
      currentHudUiScale: 1,
      lastBannerRoomId: sim.currentRoomId,
      lastBannerWaveNumber: sim.waveNumber,
      lastBannerRoomCleared: sim.getCurrentRoom().cleared,
      hudBannerTimer: 0,
      playerHitIndicatorTimer: 0,
      fullMapOpen: false,
      bossTitleText: { visible: false },
      reactionBannerGraphics: createMockGraphics(),
      reactionBannerText,
      fx: {
        getActiveReactionBanner: () => ({
          label: 'VAPORIZE',
          colorHex: '#38BDF8',
          totalDamage: 48,
          displayTimerSec: 0.9,
          isTeamCombo: false,
        }),
      },
    };

    // Idle Secret Trial -> by = 10 -> text center Y = 10 + 11 = 21
    sim.secretTrialActive = false;
    sim.secretTrialBannerTimer = 0;
    updateTopCenterBannersAndQolImpl.call(mockScene as never, 0.016);
    expect(rxTextY).toBe(21);

    // Active 20s Secret Trial -> by = 58 -> text center Y = 58 + 11 = 69 (clears Y=8..52 panel)
    sim.secretTrialActive = true;
    updateTopCenterBannersAndQolImpl.call(mockScene as never, 0.016);
    expect(rxTextY).toBe(69);

    // Post-trial Victory/Expired banner timer > 0 -> also stays offset at by = 58 -> Y = 69
    sim.secretTrialActive = false;
    sim.secretTrialBannerTimer = 2.5;
    updateTopCenterBannersAndQolImpl.call(mockScene as never, 0.016);
    expect(rxTextY).toBe(69);
  });

  it('maps duo_cryo_shatter_spire and duo_napalm_chain_plague explosion events to CYAN_FROST and FLAME_ORANGE', () => {
    const sim = new WorldSim({ seed: 9416, startInHub: false });
    const burstColors: string[] = [];
    const lightColors: string[] = [];
    const mockScene = {
      sim,
      transport: { getSim: () => sim },
      camFocusX: 320,
      camFocusY: 240,
      fx: {
        spawnExplosionBurst: (_x: number, _y: number, _r: number, colorHex: string) => {
          burstColors.push(colorHex);
        },
      },
      lighting: {
        spawnTransientLight: (_x: number, _y: number, _r: number, colorHex: string) => {
          lightColors.push(colorHex);
        },
      },
    };

    processSimEventsImpl.call(mockScene as never, [
      {
        kind: 'explosion',
        x: 240,
        y: 220,
        radius: 80,
        damage: 34,
        sourceDefId: 'duo_cryo_shatter_spire',
      },
      {
        kind: 'explosion',
        x: 360,
        y: 260,
        radius: 110,
        damage: 32,
        sourceDefId: 'duo_napalm_chain_plague',
      },
    ]);

    expect(burstColors).toEqual([PALETTE.CYAN_FROST, PALETTE.FLAME_ORANGE]);
    expect(lightColors).toEqual([PALETTE.CYAN_FROST, PALETTE.FLAME_ORANGE]);
  });

  it('plays secret_trial_started and secret_trial_resolved SFX via zzfx even when scene.lighting is undefined', () => {
    const sim = new WorldSim({ seed: 9417, startInHub: false });
    const activeRoomId = sim.currentRoomId;
    const sceneWithoutLighting = {
      sim,
      camFocusX: 320,
      camFocusY: 240,
      lighting: undefined,
    };

    const count0 = zzfx.getPlayedCount();
    expect(
      handleP4BSimEvent(sceneWithoutLighting as never, {
        kind: 'secret_trial_started',
        roomId: activeRoomId,
        durationSec: 20,
        x: 320,
        y: 240,
      }),
    ).toBe(true);
    expect(zzfx.getPlayedCount()).toBe(count0 + 1);
    expect(zzfx.getLastPlayedId()).toBe('portal_enter');

    expect(
      handleP4BSimEvent(sceneWithoutLighting as never, {
        kind: 'secret_trial_resolved',
        roomId: activeRoomId,
        victory: true,
        bonusGold: 40,
        x: 320,
        y: 240,
      }),
    ).toBe(true);
    expect(zzfx.getPlayedCount()).toBe(count0 + 2);
    expect(zzfx.getLastPlayedId()).toBe('chest_open');

    expect(
      handleP4BSimEvent(sceneWithoutLighting as never, {
        kind: 'secret_trial_resolved',
        roomId: activeRoomId,
        victory: false,
        bonusGold: 0,
        x: 320,
        y: 240,
      }),
    ).toBe(true);
    expect(zzfx.getPlayedCount()).toBe(count0 + 3);
    expect(zzfx.getLastPlayedId()).toBe('ui_click');

    // Verify 1:1 top-down circularity (zero 3/4 strokeEllipse squash) and groundHazardGraphics (<= 0.08 fill) routing in Duo Boons
    const simDuoFloor = new WorldSim({ seed: 9418, startInHub: false });
    simDuoFloor.player.duoBoonIds = ['duo_napalm_chain_plague', 'duo_superheated_cyclone'];
    const afflicted = simDuoFloor.spawnEnemy('goblin_shooter', 320, 260, true);
    afflicted.napalmPlagueTimer = 2.5;
    afflicted.napalmPlagueOwnerId = simDuoFloor.player.id;
    const groundAlphas: number[] = [];
    const groundG = {
      ...createMockGraphics(),
      fillStyle: (_col?: number, a?: number) => {
        if (typeof a === 'number') groundAlphas.push(a);
      },
    };
    const elevatedG = createMockGraphics();
    renderP4BDuoAndSecretArenaOverlays({
      sim: simDuoFloor,
      telegraphGraphics: elevatedG,
      groundHazardGraphics: groundG,
      visualFreeze: true,
    } as never);
    expect(elevatedG.calls).not.toContain('strokeEllipse');
    expect(groundG.calls).not.toContain('strokeEllipse');
    expect(groundG.calls).toContain('strokeCircle');
    expect(Math.max(...groundAlphas)).toBeLessThanOrEqual(0.08);
  });
});
