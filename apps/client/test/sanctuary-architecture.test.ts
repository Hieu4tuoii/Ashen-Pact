import { type CharacterId, i18n, WorldSim } from '@ashen-pact/shared';
import type Phaser from 'phaser';
import { describe, expect, it, vi } from 'vitest';
import { hexToNum, PALETTE } from '../src/art/palette.js';
import {
  CHARACTER_THEME_COLORS,
  type InteractableLightEntry,
  populateInteractableLightsScratch,
} from '../src/fx/lighting-config.js';
import {
  buildSanctuaryArchitectureSpec,
  isSanctuaryHudChromeClick,
  resolveHeroLoungeLabelState,
  resolveHeroStationVisualState,
  resolveHubWorldPointerClick,
  resolveSanctuaryGuideSpecs,
  SanctuaryVisualLayer,
} from '../src/scenes/game-scene/sanctuary-architecture.js';

interface RecordedDrawCall {
  method: string;
  args: number[];
}

function createMockPhaserGraphics() {
  const calls: RecordedDrawCall[] = [];
  const g = {
    depth: 0,
    blendMode: 0,
    visible: true,
    destroyed: false,
    calls,
    clear: vi.fn(() => {
      calls.push({ method: 'clear', args: [] });
      return g;
    }),
    setDepth: vi.fn((d: number) => {
      g.depth = d;
      return g;
    }),
    setBlendMode: vi.fn((m: number) => {
      g.blendMode = m;
      return g;
    }),
    setVisible: vi.fn((v: boolean) => {
      g.visible = v;
      return g;
    }),
    fillStyle: vi.fn((color: number, alpha = 1) => {
      calls.push({ method: 'fillStyle', args: [color, alpha] });
      return g;
    }),
    lineStyle: vi.fn((width: number, color: number, alpha = 1) => {
      calls.push({ method: 'lineStyle', args: [width, color, alpha] });
      return g;
    }),
    fillRect: vi.fn((x: number, y: number, w: number, h: number) => {
      calls.push({ method: 'fillRect', args: [x, y, w, h] });
      return g;
    }),
    strokeRect: vi.fn((x: number, y: number, w: number, h: number) => {
      calls.push({ method: 'strokeRect', args: [x, y, w, h] });
      return g;
    }),
    fillRoundedRect: vi.fn((x: number, y: number, w: number, h: number, r = 0) => {
      calls.push({ method: 'fillRoundedRect', args: [x, y, w, h, r] });
      return g;
    }),
    strokeRoundedRect: vi.fn((x: number, y: number, w: number, h: number, r = 0) => {
      calls.push({ method: 'strokeRoundedRect', args: [x, y, w, h, r] });
      return g;
    }),
    fillCircle: vi.fn((x: number, y: number, r: number) => {
      calls.push({ method: 'fillCircle', args: [x, y, r] });
      return g;
    }),
    strokeCircle: vi.fn((x: number, y: number, r: number) => {
      calls.push({ method: 'strokeCircle', args: [x, y, r] });
      return g;
    }),
    fillEllipse: vi.fn((x: number, y: number, w: number, h: number) => {
      calls.push({ method: 'fillEllipse', args: [x, y, w, h] });
      return g;
    }),
    strokeEllipse: vi.fn((x: number, y: number, w: number, h: number) => {
      calls.push({ method: 'strokeEllipse', args: [x, y, w, h] });
      return g;
    }),
    fillTriangle: vi.fn((x0: number, y0: number, x1: number, y1: number, x2: number, y2: number) => {
      calls.push({ method: 'fillTriangle', args: [x0, y0, x1, y1, x2, y2] });
      return g;
    }),
    strokeTriangle: vi.fn(
      (x0: number, y0: number, x1: number, y1: number, x2: number, y2: number) => {
        calls.push({ method: 'strokeTriangle', args: [x0, y0, x1, y1, x2, y2] });
        return g;
      },
    ),
    lineBetween: vi.fn((x0: number, y0: number, x1: number, y1: number) => {
      calls.push({ method: 'lineBetween', args: [x0, y0, x1, y1] });
      return g;
    }),
    beginPath: vi.fn(() => {
      calls.push({ method: 'beginPath', args: [] });
      return g;
    }),
    moveTo: vi.fn((x: number, y: number) => {
      calls.push({ method: 'moveTo', args: [x, y] });
      return g;
    }),
    lineTo: vi.fn((x: number, y: number) => {
      calls.push({ method: 'lineTo', args: [x, y] });
      return g;
    }),
    arc: vi.fn((x: number, y: number, r: number, startAngle: number, endAngle: number) => {
      calls.push({ method: 'arc', args: [x, y, r, startAngle, endAngle] });
      return g;
    }),
    closePath: vi.fn(() => {
      calls.push({ method: 'closePath', args: [] });
      return g;
    }),
    fillPath: vi.fn(() => {
      calls.push({ method: 'fillPath', args: [] });
      return g;
    }),
    strokePath: vi.fn(() => {
      calls.push({ method: 'strokePath', args: [] });
      return g;
    }),
    destroy: vi.fn(() => {
      g.destroyed = true;
    }),
  };
  return g;
}

describe('Ashen Sanctuary 5-Wing Visual Architecture, Embodied Hero Rigs & Click-to-Select', () => {
  it('buildSanctuaryArchitectureSpec(1152, 704) defines 6 distinct zones, 5 themed heroRugs, 4 rackStands, coopStation, codexStation, and central hearth', () => {
    const spec = buildSanctuaryArchitectureSpec(1152, 704);

    expect(spec.zones.map((z) => z.id)).toEqual([
      'north_gate',
      'central_hearth',
      'hero_lounge',
      'east_coop',
      'west_armory',
      'southeast_codex',
    ]);
    expect(new Set(spec.zones.map((z) => z.id)).size).toBe(6);

    // Central hearth at (576, 352) with r = 46 and 8-point brass astrolabe + 3 benches
    expect(spec.hearth.x).toBe(576);
    expect(spec.hearth.y).toBe(352);
    expect(spec.hearth.radius).toBe(46);
    expect(spec.hearth.astrolabePoints).toBe(8);
    expect(spec.hearth.benchCount).toBe(3);

    // North Gate carpet runner & portal dais at (576, 122)
    expect(spec.portalDais.x).toBe(576);
    expect(spec.portalDais.y).toBe(122);
    expect(spec.northCarpet.xMin).toBe(532);
    expect(spec.northCarpet.xMax).toBe(620);
    expect(spec.northCarpet.yMin).toBe(122);
    expect(spec.northCarpet.yMax).toBe(352);

    // 5 bespoke class rugs matching all 5 CharacterIds and CHARACTER_THEME_COLORS
    expect(spec.heroRugs).toHaveLength(5);
    const expectedHeroCoords: Record<CharacterId, [number, number]> = {
      vanguard: [388, 224],
      ranger: [452, 160],
      elementalist: [700, 160],
      druid: [388, 316],
      engineer: [764, 224],
    };
    for (const [cid, [ex, ey]] of Object.entries(expectedHeroCoords) as [
      CharacterId,
      [number, number],
    ][]) {
      const rug = spec.heroRugs.find((r) => r.characterId === cid);
      expect(rug).toBeDefined();
      expect(rug?.x).toBe(ex);
      expect(rug?.y).toBe(ey);
      expect(rug?.colorHex).toBe(CHARACTER_THEME_COLORS[cid]);
    }

    // 4 West Armory Weapon Display Pedestals at (206/326, 404/488) & range bullseye at (236, 236)
    expect(spec.shootingRange.x).toBe(236);
    expect(spec.shootingRange.y).toBe(236);
    expect(spec.rackStands.map((s) => [s.x, s.y])).toEqual([
      [206, 404],
      [326, 404],
      [206, 488],
      [326, 488],
    ]);

    // East Co-op Guild Table at (928, 352) + runner (626..928, 330..374) & SE Codex Lectern at (860, 520)
    expect(spec.eastRunner.xMin).toBe(626);
    expect(spec.eastRunner.xMax).toBe(928);
    expect(spec.eastRunner.yMin).toBe(330);
    expect(spec.eastRunner.yMax).toBe(374);
    expect(spec.coopStation.x).toBe(928);
    expect(spec.coopStation.y).toBe(352);
    expect(spec.codexStation.x).toBe(860);
    expect(spec.codexStation.y).toBe(520);
  });

  it('resolveHeroStationVisualState dims embodied lounging hero rigs to 0.38 with active badge regardless of allowDuplicates and keeps unselected heroes at alpha 1', () => {
    expect(resolveHeroStationVisualState('vanguard', ['vanguard'], false)).toEqual({
      embodied: true,
      rigAlpha: 0.38,
      showActiveBadge: true,
    });

    expect(resolveHeroStationVisualState('druid', ['vanguard', 'druid'], true)).toEqual({
      embodied: true,
      rigAlpha: 0.38,
      showActiveBadge: true,
    });

    expect(resolveHeroStationVisualState('ranger', ['vanguard'], false)).toEqual({
      embodied: false,
      rigAlpha: 1,
      showActiveBadge: false,
    });

    expect(resolveHeroStationVisualState('ranger', ['vanguard'], true)).toEqual({
      embodied: false,
      rigAlpha: 1,
      showActiveBadge: false,
    });
  });

  it('SanctuaryVisualLayer renders static floor at depth 6 only on Hub state change and animates depth 33 deterministically via visualTimeSec', () => {
    const createdGraphics: ReturnType<typeof createMockPhaserGraphics>[] = [];
    const mockScene = {
      add: {
        graphics: vi.fn(() => {
          const g = createMockPhaserGraphics();
          createdGraphics.push(g);
          return g;
        }),
      },
    } as unknown as Phaser.Scene;

    const layer = new SanctuaryVisualLayer(mockScene);
    expect(createdGraphics).toHaveLength(2);
    const [floorG, dynamicG] = createdGraphics as [
      ReturnType<typeof createMockPhaserGraphics>,
      ReturnType<typeof createMockPhaserGraphics>,
    ];
    expect(floorG.depth).toBe(6);
    expect(dynamicG.depth).toBe(33);

    const sim = new WorldSim({
      seed: 'sanctuary-layer-test',
      spawnInitialWave: false,
      includeTrainingDummy: false,
      includeProps: false,
    });

    // In dungeon (!sim.inHub): hidden, no Sanctuary carpets drawn,surfaces remain 'none'
    layer.sync(sim, 0.016, 1.0);
    expect(floorG.visible).toBe(false);
    expect(dynamicG.visible).toBe(false);

    // Enter Hub: floorGraphics draws static Sanctuary once; sim.map.surfaces remain untouched ('none')
    sim.enterHub();
    for (let ty = 0; ty < sim.map.rows; ty++) {
      for (let tx = 0; tx < sim.map.cols; tx++) {
        expect(sim.map.getSurface(tx, ty)).toBe('none');
      }
    }

    floorG.clear.mockClear();
    layer.sync(sim, 0.016, 1.0);
    expect(floorG.visible).toBe(true);
    expect(dynamicG.visible).toBe(true);
    expect(floorG.clear).toHaveBeenCalledTimes(1);
    expect(floorG.calls.length).toBeGreaterThan(30);
    const frozenCallsSnapshot1 = structuredClone(dynamicG.calls);

    // Subsequent Hub frame with unchanged map/locale does NOT redraw static floorGraphics
    // and frozen visualTimeSec (1.0) produces 100% identical dynamicGraphics draw calls
    floorG.clear.mockClear();
    dynamicG.calls.length = 0;
    layer.sync(sim, 0.016, 1.0);
    expect(floorG.clear).not.toHaveBeenCalled();
    expect(dynamicG.calls).toEqual(frozenCallsSnapshot1);

    // Advancing visualTimeSec animates embers, beacon pulse, and candle glow
    dynamicG.calls.length = 0;
    layer.sync(sim, 0.016, 1.65);
    expect(dynamicG.calls).not.toEqual(frozenCallsSnapshot1);

    // Leaving Hub hides both layers cleanly
    sim.startDungeonRunFromHub();
    layer.sync(sim, 0.016, 2.0);
    expect(floorG.visible).toBe(false);
    expect(dynamicG.visible).toBe(false);

    layer.destroy();
    expect(floorG.destroyed).toBe(true);
    expect(dynamicG.destroyed).toBe(true);
  });

  it('resolveHubWorldPointerClick enforces exact radii (30u statue in Solo & Co-op, 34u coop_board, 32u codex_desk) and modal guards', () => {
    const sim = new WorldSim({ seed: 'sanctuary-click-test', spawnInitialWave: false });
    sim.enterHub();

    // Solo, Host, and Join clicks within 30u of lounging heroes select that character
    expect(
      resolveHubWorldPointerClick({
        inHub: true,
        coopMode: 'solo',
        modalOpen: false,
        worldX: 452 + 24,
        worldY: 160,
        hubStatues: sim.hubStatues,
        hubStations: sim.hubStations,
      }),
    ).toEqual({ kind: 'select_character', characterId: 'ranger' });

    expect(
      resolveHubWorldPointerClick({
        inHub: true,
        coopMode: 'host',
        modalOpen: false,
        worldX: 452,
        worldY: 160,
        hubStatues: sim.hubStatues,
        hubStations: sim.hubStations,
      }),
    ).toEqual({ kind: 'select_character', characterId: 'ranger' });

    expect(
      resolveHubWorldPointerClick({
        inHub: true,
        coopMode: 'join',
        modalOpen: false,
        worldX: 388,
        worldY: 316 - 20,
        hubStatues: sim.hubStatues,
        hubStations: sim.hubStations,
      }),
    ).toEqual({ kind: 'select_character', characterId: 'druid' });

    // Outside 30u -> null; Modal open -> null
    expect(
      resolveHubWorldPointerClick({
        inHub: true,
        coopMode: 'solo',
        modalOpen: false,
        worldX: 452 + 32,
        worldY: 160,
        hubStatues: sim.hubStatues,
        hubStations: sim.hubStations,
      }),
    ).toBeNull();
    expect(
      resolveHubWorldPointerClick({
        inHub: true,
        coopMode: 'solo',
        modalOpen: true,
        worldX: 452,
        worldY: 160,
        hubStatues: sim.hubStatues,
        hubStations: sim.hubStations,
      }),
    ).toBeNull();

    // Click within 34u of coop_board (928, 352) -> toggle_coop_board
    expect(
      resolveHubWorldPointerClick({
        inHub: true,
        coopMode: 'solo',
        modalOpen: false,
        worldX: 928 - 33,
        worldY: 352,
        hubStatues: sim.hubStatues,
        hubStations: sim.hubStations,
      }),
    ).toEqual({ kind: 'toggle_coop_board' });
    expect(
      resolveHubWorldPointerClick({
        inHub: true,
        coopMode: 'solo',
        modalOpen: false,
        worldX: 928 - 36,
        worldY: 352,
        hubStatues: sim.hubStatues,
        hubStations: sim.hubStations,
      }),
    ).toBeNull();

    // Click within 32u of codex_desk (860, 520) -> open_codex_desk
    expect(
      resolveHubWorldPointerClick({
        inHub: true,
        coopMode: 'solo',
        modalOpen: false,
        worldX: 860,
        worldY: 520 + 31,
        hubStatues: sim.hubStatues,
        hubStations: sim.hubStations,
      }),
    ).toEqual({ kind: 'open_codex_desk' });
    expect(
      resolveHubWorldPointerClick({
        inHub: true,
        coopMode: 'solo',
        modalOpen: false,
        worldX: 860,
        worldY: 520 + 34,
        hubStatues: sim.hubStatues,
        hubStations: sim.hubStations,
      }),
    ).toBeNull();
  });

  it('populateInteractableLightsScratch emits warm azure light for coop_board and warm gold light for codex_desk in Hub', () => {
    const sim = new WorldSim({ seed: 'sanctuary-station-lights', spawnInitialWave: false });
    sim.enterHub();

    const scratch: InteractableLightEntry[] = [];
    populateInteractableLightsScratch(scratch, {
      tier: 'high',
      biome: 1,
      inHub: true,
      elapsedSec: 1.0,
      hubStations: sim.hubStations,
    });

    const coopLight = scratch.find((l) => l.kind === 'hub_station' && l.x === 928 && l.y === 352);
    const codexLight = scratch.find((l) => l.kind === 'hub_station' && l.x === 860 && l.y === 520);
    expect(coopLight).toBeDefined();
    expect(coopLight?.colorNum).toBe(hexToNum(PALETTE.AZURE_CORE));
    expect(coopLight?.alpha).toBeLessThanOrEqual(0.35);

    expect(codexLight).toBeDefined();
    expect(codexLight?.colorNum).toBe(hexToNum(PALETTE.SOLAR_GOLD));
    expect(codexLight?.alpha).toBeLessThanOrEqual(0.35);
  });

  it('resolves localized embodied hero badge (VI/EN), raised y-42 hero labels, and non-overlapping wrapped 5-Wing guide sign coordinates', async () => {
    const prevLocale = i18n.getLocale();
    try {
      i18n.setLocale('vi');
      const embodiedVi = resolveHeroLoungeLabelState({
        characterId: 'vanguard',
        characterName: 'Thiết Vệ',
        stationVisual: resolveHeroStationVisualState('vanguard', ['vanguard'], false),
        playerX: 400,
        playerY: 224,
        statueX: 388,
        statueY: 224,
        modalOrMapOpen: false,
        isTargetedStatue: false,
      });
      expect(embodiedVi.subLabelVisible).toBe(true);
      expect(embodiedVi.subLabelText).toBe('★ Đang hóa thân');
      expect(embodiedVi.labelVisible).toBe(false);

      i18n.setLocale('en');
      const embodiedEn = resolveHeroLoungeLabelState({
        characterId: 'vanguard',
        characterName: 'Vanguard',
        stationVisual: resolveHeroStationVisualState('vanguard', ['vanguard'], false),
        playerX: 400,
        playerY: 224,
        statueX: 388,
        statueY: 224,
        modalOrMapOpen: false,
        isTargetedStatue: false,
      });
      expect(embodiedEn.subLabelVisible).toBe(true);
      expect(embodiedEn.subLabelText).toBe('★ Active');

      // Unselected lounging hero within 240u -> subtle name label visible; beyond 240u -> hidden
      const rangerVisual = resolveHeroStationVisualState('ranger', ['vanguard'], false);
      const nearUnselected = resolveHeroLoungeLabelState({
        characterId: 'ranger',
        characterName: 'Ranger',
        stationVisual: rangerVisual,
        playerX: 576,
        playerY: 316, // dist to (452, 160) = ~199u <= 240u
        statueX: 452,
        statueY: 160,
        modalOrMapOpen: false,
        isTargetedStatue: false,
      });
      expect(nearUnselected.labelVisible).toBe(true);
      expect(nearUnselected.labelText).toBe('Ranger');
      expect(nearUnselected.subLabelVisible).toBe(false);

      const farUnselected = resolveHeroLoungeLabelState({
        characterId: 'ranger',
        characterName: 'Ranger',
        stationVisual: rangerVisual,
        playerX: 860,
        playerY: 520, // > 240u
        statueX: 452,
        statueY: 160,
        modalOrMapOpen: false,
        isTargetedStatue: false,
      });
      expect(farUnselected.labelVisible).toBe(false);

      // 6 5-Wing guide sign coordinates at canonical 1152x704 Hub
      const guides = resolveSanctuaryGuideSpecs({
        mapWidth: 1152,
        mapHeight: 704,
        rollingDps: 42.5,
        camScrollX: 0,
        invitePanelVisible: false,
        fullMapOpen: false,
        previewOpen: false,
        modalOrMapOpen: false,
        weaponComparisonVisible: false,
        target: null,
      });
      expect(guides.map((g) => [g.x, g.y])).toEqual([
        [576, 174],
        [576, 266],
        [266, 368],
        [236, 192],
        [928, 304],
        [860, 480],
      ]);
      expect(guides[0]?.blocked).toBe(false);
      expect((guides[0] as { wordWrapWidth?: number }).wordWrapWidth).toBe(176);
      expect((guides[1] as { wordWrapWidth?: number }).wordWrapWidth).toBe(240);
      expect(guides[3]?.text).toContain('42.5');
      expect(guides[4]?.text).toBe(i18n.t('ui.sanctuary.coopWingSign'));
      expect(guides[5]?.text).toBe(i18n.t('ui.sanctuary.codexWingSign'));

      // portalSign and statuesSign are BOTH blocked when previewOpen is true (e.g. inspecting Ranger at 452, 160)
      const guidesWithPreview = resolveSanctuaryGuideSpecs({
        mapWidth: 1152,
        mapHeight: 704,
        rollingDps: 0,
        camScrollX: 0,
        invitePanelVisible: false,
        fullMapOpen: false,
        previewOpen: true,
        modalOrMapOpen: false,
        weaponComparisonVisible: false,
        target: null,
      });
      expect(guidesWithPreview[0]?.blocked).toBe(true);
      expect(guidesWithPreview[1]?.blocked).toBe(true);

      // Hero lounge label offset raised to st.y - 42 (not st.y - 32) so Mộc Linh clears Druid's 1.12x helmet
      const archMod = (await import('../src/scenes/game-scene/sanctuary-architecture.js')) as {
        HERO_LOUNGE_LABEL_OFFSET_Y?: number;
      };
      expect(archMod.HERO_LOUNGE_LABEL_OFFSET_Y).toBe(-42);
      const fs = await import('node:fs');
      const path = await import('node:path');
      const roomSyncSrc = fs.readFileSync(
        path.resolve(__dirname, '../src/scenes/game-scene/room-entities-sync.ts'),
        'utf8',
      );
      expect(roomSyncSrc).not.toContain('st.y - 32');
      expect(roomSyncSrc).toContain('HERO_LOUNGE_LABEL_OFFSET_Y');
    } finally {
      i18n.setLocale(prevLocale);
    }
  });

  it('isSanctuaryHudChromeClick distinguishes Solo drawer bottom (356*s) from Co-op drawer bottom (426*s) so codex_desk stays clickable in Solo', () => {
    const sim = new WorldSim({ seed: 'sanctuary-hud-chrome-test', spawnInitialWave: false });
    sim.enterHub();

    // 1. Clicking collapseHit on open Invite Panel flips invitePanelVisible -> false in HudScene first,
    //    but HudScene.input.hitTestPointer(pointer) still returns the interactive hitbox (hudHitCount = 1)
    expect(
      isSanctuaryHudChromeClick({
        inHub: true,
        coopMode: 'solo',
        invitePanelVisible: false,
        hudX: 912,
        hudY: 158,
        hudPadX: 0,
        hudPadY: 0,
        hudUiScale: 1,
        hudHitCount: 1,
      } as Parameters<typeof isSanctuaryHudChromeClick>[0]),
    ).toBe(true);

    // 2. Clicking collapsed "📡 Invite" chip (!invitePanelVisible, x: 782..948, y: 144..170) is caught by hudHitCount > 0 at any uiScale
    expect(
      isSanctuaryHudChromeClick({
        inHub: true,
        coopMode: 'solo',
        invitePanelVisible: false,
        hudX: 840,
        hudY: 156,
        hudPadX: 0,
        hudPadY: 0,
        hudUiScale: 1.15,
        hudHitCount: 1,
      } as Parameters<typeof isSanctuaryHudChromeClick>[0]),
    ).toBe(true);

    // 3. Solo Co-op Drawer uses height 212 -> bottom = 356 * s - padY:
    //    Inside Solo drawer (hudY = 355) -> blocked (true), while codex_desk at spawn (hudX = 764, hudY = 378) -> NOT blocked (false)!
    expect(
      isSanctuaryHudChromeClick({
        inHub: true,
        coopMode: 'solo',
        invitePanelVisible: true,
        hudX: 764,
        hudY: 355,
        hudPadX: 0,
        hudPadY: 0,
        hudUiScale: 1,
        hudHitCount: 0,
      } as Parameters<typeof isSanctuaryHudChromeClick>[0]),
    ).toBe(true);
    expect(
      isSanctuaryHudChromeClick({
        inHub: true,
        coopMode: 'solo',
        invitePanelVisible: true,
        hudX: 764,
        hudY: 378,
        hudPadX: 0,
        hudPadY: 0,
        hudUiScale: 1,
        hudHitCount: 0,
      } as Parameters<typeof isSanctuaryHudChromeClick>[0]),
    ).toBe(false);

    // 4. Co-op Invite Panel ('host' / 'join') uses height 282 -> bottom = 426 * s - padY:
    //    hudY = 378 and scaled hudY = 475 (at s = 1.15, padX = 20, padY = 10 -> 426 * 1.15 - 10 = 479.9) ARE blocked (true)
    expect(
      isSanctuaryHudChromeClick({
        inHub: true,
        coopMode: 'host',
        invitePanelVisible: true,
        hudX: 764,
        hudY: 378,
        hudPadX: 0,
        hudPadY: 0,
        hudUiScale: 1,
        hudHitCount: 0,
      } as Parameters<typeof isSanctuaryHudChromeClick>[0]),
    ).toBe(true);
    expect(
      isSanctuaryHudChromeClick({
        inHub: true,
        coopMode: 'join',
        invitePanelVisible: true,
        hudX: 642,
        hudY: 475,
        hudPadX: 20,
        hudPadY: 10,
        hudUiScale: 1.15,
        hudHitCount: 0,
      } as Parameters<typeof isSanctuaryHudChromeClick>[0]),
    ).toBe(true);

    //    At s = 0.85, pad = 0: x = [708.4, 949.8], y = [122.4, 362.1] -> hudX = 685 is outside the smaller panel
    expect(
      isSanctuaryHudChromeClick({
        inHub: true,
        coopMode: 'host',
        invitePanelVisible: true,
        hudX: 685,
        hudY: 240,
        hudPadX: 0,
        hudPadY: 0,
        hudUiScale: 0.85,
        hudHitCount: 0,
      } as Parameters<typeof isSanctuaryHudChromeClick>[0]),
    ).toBe(false);

    // 5. resolveHubWorldPointerClick returns null when isClickingHudChrome is true even directly over coop_board (928, 352)
    expect(
      resolveHubWorldPointerClick({
        inHub: true,
        coopMode: 'solo',
        modalOpen: false,
        isClickingHudChrome: true,
        worldX: 928,
        worldY: 352,
        hubStatues: sim.hubStatues,
        hubStations: sim.hubStations,
      }),
    ).toBeNull();
  });
});

