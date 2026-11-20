import { i18n, WEAPONS, WorldSim } from '@ashen-pact/shared';
import type Phaser from 'phaser';
import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => {
  class MockPostFXPipeline {
    public game: unknown;
    public name: string;
    constructor(config: { game: unknown; name: string }) {
      this.game = config.game;
      this.name = config.name;
    }
    set1f() {}
    set3f() {}
  }
  class MockSinglePipeline {
    public config: unknown;
    public vertexCount = 0;
    constructor(config: unknown) {
      this.config = config;
    }
    flush() {
      this.vertexCount = 0;
    }
    set1f() {}
    set3f() {}
  }
  class MockWebGLRenderer {}
  class MockScene {
    constructor(_config?: unknown) {}
  }
  const PhaserMock = {
    Scene: MockScene,
    GameObjects: { Container: class {} },
    BlendModes: { NORMAL: 0, ADD: 1, MULTIPLY: 2, SCREEN: 3 },
    Scenes: { Events: { SHUTDOWN: 'shutdown' } },
    Math: {
      Clamp: (v: number, min: number, max: number) => Math.max(min, Math.min(max, v)),
    },
    Renderer: {
      WebGL: {
        WebGLRenderer: MockWebGLRenderer,
        Pipelines: {
          PostFXPipeline: MockPostFXPipeline,
          SinglePipeline: MockSinglePipeline,
        },
      },
    },
  };
  return { default: PhaserMock, ...PhaserMock };
});

import type { GameScene } from '../src/scenes/GameScene.js';
import {
  ALL_ASHEN_PACT_IDS,
  drawPlayerPactAndRelicHudBadges,
} from '../src/scenes/game-scene/hud-ashen-pact-modal.js';
import {
  drawBossArmorFrameAndTacticalHintHud,
  updateVectorHudImpl,
} from '../src/scenes/game-scene/hud-combat-and-coop.js';
import { updateDebugStateImpl } from '../src/scenes/game-scene/hud-modals-and-debug.js';
import { computeRoomsTopologyHash } from '../src/scenes/game-scene/hud-qol-and-minimap.js';
import {
  computeRemainingEnemiesText,
  updateP11RemainingEnemiesHud,
} from '../src/scenes/game-scene/p11-drama-hud.js';
import { initGlobalDebugState } from '../src/ui/debug-overlay.js';
import {
  setColorIfChanged,
  setTextAndColorIfChanged,
  setTextIfChanged,
} from '../src/ui/phaser-text-guard.js';
import { renderSecretArenaCountdownHud, syncSecretArenaHud } from '../src/ui/secret-arena-hud.js';

function createNoopGraphics() {
  const g = {
    visible: true,
    clear: vi.fn(() => g),
    fillStyle: vi.fn(() => g),
    lineStyle: vi.fn(() => g),
    fillRect: vi.fn(() => g),
    strokeRect: vi.fn(() => g),
    fillRoundedRect: vi.fn(() => g),
    strokeRoundedRect: vi.fn(() => g),
    fillCircle: vi.fn(() => g),
    strokeCircle: vi.fn(() => g),
    fillTriangle: vi.fn(() => g),
    strokeTriangle: vi.fn(() => g),
    beginPath: vi.fn(() => g),
    closePath: vi.fn(() => g),
    moveTo: vi.fn(() => g),
    lineTo: vi.fn(() => g),
    arc: vi.fn(() => g),
    lineBetween: vi.fn(() => g),
    fillPath: vi.fn(() => g),
    strokePath: vi.fn(() => g),
    setPosition: vi.fn(() => g),
    setScale: vi.fn(() => g),
    setVisible: vi.fn((v: boolean) => {
      g.visible = v;
      return g;
    }),
  };
  return g;
}

function createStatefulTextMock(initialText = '', initialColor = '#FFFFFF', withStyle = true) {
  let content = initialText;
  const styleObj = { color: initialColor };
  const txt: {
    scene: object;
    x: number;
    y: number;
    width: number;
    height: number;
    visible: boolean;
    active: boolean;
    text: string;
    style?: { color?: string };
    setText: ReturnType<typeof vi.fn>;
    setColor: ReturnType<typeof vi.fn>;
    setPosition: ReturnType<typeof vi.fn>;
    setOrigin: ReturnType<typeof vi.fn>;
    setDepth: ReturnType<typeof vi.fn>;
    setVisible: ReturnType<typeof vi.fn>;
    setAlpha: ReturnType<typeof vi.fn>;
    setScale: ReturnType<typeof vi.fn>;
    setY: ReturnType<typeof vi.fn>;
    setInteractive: ReturnType<typeof vi.fn>;
    disableInteractive: ReturnType<typeof vi.fn>;
  } = {
    scene: {},
    x: 0,
    y: 0,
    width: 64,
    height: 16,
    visible: true,
    active: true,
    get text() {
      return content;
    },
    set text(v: string) {
      content = v;
    },
    ...(withStyle ? { style: styleObj } : {}),
    setText: vi.fn((v: string) => {
      content = String(v);
      return txt;
    }),
    setColor: vi.fn((c: string) => {
      styleObj.color = c;
      return txt;
    }),
    setPosition: vi.fn((x: number, y: number) => {
      txt.x = x;
      txt.y = y;
      return txt;
    }),
    setOrigin: vi.fn(() => txt),
    setDepth: vi.fn(() => txt),
    setVisible: vi.fn((v: boolean) => {
      txt.visible = v;
      return txt;
    }),
    setAlpha: vi.fn(() => txt),
    setScale: vi.fn(() => txt),
    setY: vi.fn((y: number) => {
      txt.y = y;
      return txt;
    }),
    setInteractive: vi.fn(() => txt),
    disableInteractive: vi.fn(() => txt),
  };
  return txt;
}

describe('Task 1 — Phaser.Text Upload Guard, HUD Hash Decoupling & O(1) Debug Telemetry', () => {
  describe('1. phaser-text-guard: setTextIfChanged, setColorIfChanged, setTextAndColorIfChanged', () => {
    it('calls neither setText nor setColor and returns false when neither text nor style.color changed', () => {
      const txt = createStatefulTextMock('8/8', '#F4F1EA');
      expect(setTextAndColorIfChanged(txt, '8/8', '#F4F1EA')).toBe(false);
      expect(txt.setText).not.toHaveBeenCalled();
      expect(txt.setColor).not.toHaveBeenCalled();
      expect(setTextIfChanged(null, '8/8')).toBe(false);
      expect(setColorIfChanged(undefined, '#F4F1EA')).toBe(false);
      expect(setTextAndColorIfChanged(null, '8/8', '#F4F1EA')).toBe(false);
    });

    it('calls setColor(nextColor) once and setText 0 times when only nextColor changed, then no-ops on repeat', () => {
      const txt = createStatefulTextMock('RDY', '#F4F1EA');
      expect(setTextAndColorIfChanged(txt, 'RDY', '#4ADE80')).toBe(true);
      expect(txt.setText).toHaveBeenCalledTimes(0);
      expect(txt.setColor).toHaveBeenCalledTimes(1);
      expect(txt.setColor).toHaveBeenCalledWith('#4ADE80');
      expect(txt.style?.color).toBe('#4ADE80');

      expect(setTextAndColorIfChanged(txt, 'RDY', '#4ADE80')).toBe(false);
      expect(txt.setColor).toHaveBeenCalledTimes(1);
    });

    it('sets txt.style.color first and calls txt.setText once without calling setColor when both text and color change on a writable style', () => {
      let styleColorDuringSetText = '';
      const txt = createStatefulTextMock('2.4s', '#F4F1EA');
      txt.setText = vi.fn((next: string) => {
        styleColorDuringSetText = txt.style?.color ?? '';
        txt.text = next;
        return txt;
      });

      expect(setTextAndColorIfChanged(txt, 'RDY', '#4ADE80')).toBe(true);
      expect(styleColorDuringSetText).toBe('#4ADE80');
      expect(txt.style?.color).toBe('#4ADE80');
      expect(txt.text).toBe('RDY');
      expect(txt.setText).toHaveBeenCalledTimes(1);
      expect(txt.setText).toHaveBeenCalledWith('RDY');
      expect(txt.setColor).toHaveBeenCalledTimes(0);
    });

    it('safely falls back to setText + setColor and WeakMap tracking when txt.style is absent on minimal mocks', () => {
      const minimal = createStatefulTextMock('Old', '#FFFFFF', false);
      expect(minimal.style).toBeUndefined();

      expect(setTextAndColorIfChanged(minimal, 'New', '#FBBF24')).toBe(true);
      expect(minimal.setText).toHaveBeenCalledTimes(1);
      expect(minimal.setText).toHaveBeenCalledWith('New');
      expect(minimal.setColor).toHaveBeenCalledTimes(1);
      expect(minimal.setColor).toHaveBeenCalledWith('#FBBF24');

      // Second call with identical text & color must be guarded via WeakMap fallback
      expect(setTextAndColorIfChanged(minimal, 'New', '#FBBF24')).toBe(false);
      expect(minimal.setText).toHaveBeenCalledTimes(1);
      expect(minimal.setColor).toHaveBeenCalledTimes(1);

      // Color-only change on minimal mock
      expect(setColorIfChanged(minimal, '#38BDF8')).toBe(true);
      expect(minimal.setColor).toHaveBeenCalledTimes(2);
      expect(setColorIfChanged(minimal, '#38BDF8')).toBe(false);
      expect(minimal.setColor).toHaveBeenCalledTimes(2);
    });
  });

  describe('2. updateP11RemainingEnemiesHud: caches signature across unchanged frames and updates immediately on kill', () => {
    it('invokes pill.setText and pill.setColor only on frame 1 across 10 unchanged frames while keeping __P11_REMAINING_HUD_TEXT__ accurate and updating when aliveCombat drops to 4', () => {
      const prevWindow = (globalThis as { window?: unknown }).window;
      const winObj: Record<string, unknown> = {
        addEventListener: vi.fn(),
        devicePixelRatio: 1,
      };
      (globalThis as { window?: unknown }).window = winObj;

      try {
        i18n.setLocale('vi');
        const sim = new WorldSim({ seed: 101, startInHub: false });
        const room = sim.getCurrentRoom();
        room.cleared = false;
        room.wavesSpawned = 1;
        room.wavesTotal = 3;
        room.isChallenge = false;

        sim.enemies.length = 0;
        for (let i = 0; i < 5; i++) {
          const e = sim.spawnEnemy('goblin_shooter', 200 + i * 24, 200, true);
          e.isDummy = false;
          e.isBoss = false;
          e.hp = 30;
        }

        // Use minimal mock (no .style) so frame 1 invokes both setText and setColor once, and frames 2-10 invoke 0 times
        let createdPill: ReturnType<typeof createStatefulTextMock> | null = null;
        const uiScene = {
          add: {
            text: vi.fn((x: number, y: number, initText: string) => {
              const pill = createStatefulTextMock(initText, '#FFFFFF', false);
              pill.scene = uiScene;
              pill.x = x;
              pill.y = y;
              createdPill = pill;
              return pill;
            }),
          },
        };

        const scene = {
          fullMapOpen: false,
          uiScene,
          transport: { getSim: () => sim },
        } as unknown as GameScene;

        const expected5 = computeRemainingEnemiesText(5, 1, 3, false, 'vi');
        const expected4 = computeRemainingEnemiesText(4, 1, 3, false, 'vi');

        // Frame 1
        updateP11RemainingEnemiesHud(scene);
        expect(createdPill).not.toBeNull();
        expect(createdPill!.setText).toHaveBeenCalledTimes(1);
        expect(createdPill!.setColor).toHaveBeenCalledTimes(1);
        expect(winObj.__P11_REMAINING_HUD_TEXT__).toBe(expected5);

        // Frames 2-10 with unchanged aliveCombat = 5, wavesSpawned = 1, wavesTotal = 3, and pill position
        for (let frame = 2; frame <= 10; frame++) {
          updateP11RemainingEnemiesHud(scene);
        }
        expect(createdPill!.setText).toHaveBeenCalledTimes(1);
        expect(createdPill!.setColor).toHaveBeenCalledTimes(1);
        expect(winObj.__P11_REMAINING_HUD_TEXT__).toBe(expected5);

        // Drop aliveCombat from 5 -> 4: updates immediately on that frame
        sim.enemies[0]!.hp = 0;
        updateP11RemainingEnemiesHud(scene);
        expect(createdPill!.setText).toHaveBeenCalledTimes(2);
        expect(createdPill!.setText).toHaveBeenLastCalledWith(expected4);
        expect(winObj.__P11_REMAINING_HUD_TEXT__).toBe(expected4);
      } finally {
        if (prevWindow === undefined) {
          delete (globalThis as { window?: unknown }).window;
        } else {
          (globalThis as { window?: unknown }).window = prevWindow;
        }
      }
    });
  });

  describe('3. updateVectorHudImpl: decouples weaponHash from per-shot/reload/heat/combo cadence churn', () => {
    it('does not clear weaponSlotBgs or call setText/setColor on weapon slot texts when clipAmmo, weaponHeat, reloadTimer, or meleeComboStep change', () => {
      i18n.setLocale('vi');
      const sim = new WorldSim({ seed: 202, startInHub: false });
      sim.stressTestActive = true; // bypass unrelated sub-HUD calls after weapon cards
      const p = sim.player;

      const clipWeapon = Object.values(WEAPONS).find((w) => w.cadenceKind === 'CLIP_RELOAD')!;
      const heatWeapon = Object.values(WEAPONS).find((w) => w.cadenceKind === 'HEAT_VENT')!;
      p.weaponSlots = [clipWeapon.id, heatWeapon.id];
      p.activeWeaponSlot = 0;
      p.clipMax = clipWeapon.clipSize;
      p.clipAmmo = clipWeapon.clipSize;
      p.weaponHeat = 0;
      p.reloadTimer = 0;
      p.meleeComboStep = 0;

      const slotBgs = [createNoopGraphics(), createNoopGraphics()];
      const iconSprites = [
        {
          setVisible: vi.fn(),
          setTexture: vi.fn(),
          setPosition: vi.fn(),
          setScale: vi.fn(),
          setAlpha: vi.fn(),
        },
        {
          setVisible: vi.fn(),
          setTexture: vi.fn(),
          setPosition: vi.fn(),
          setScale: vi.fn(),
          setAlpha: vi.fn(),
        },
      ];
      const keyTexts = [createStatefulTextMock('1', '#FACC15'), createStatefulTextMock('2', '#C7D2E8')];
      const nameTexts = [createStatefulTextMock('', '#FFFFFF'), createStatefulTextMock('', '#FFFFFF')];
      const metaTexts = [createStatefulTextMock('', '#FFFFFF'), createStatefulTextMock('', '#FFFFFF')];

      const energyLabelText = createStatefulTextMock('', '#38BDF8');

      const scene = {
        coopMode: 'solo',
        currentHudUiScale: 1.0,
        hudPadX: 0,
        hudPadY: 0,
        lastHudLocale: 'vi',
        lastHudHp: -1,
        lastHudArmor: -1,
        lastHudEnergy: -1,
        lastHudGold: -1,
        lastHudCharacterId: '',
        lastHudWeaponHash: '',
        lastHudElement: '',
        lastHudQuality: '',
        lastHudStatsText: '',
        trailingHpRatio: 1,
        trailingArmorRatio: 1,
        hudBarsGraphics: createNoopGraphics(),
        abilityHudGraphics: createNoopGraphics(),
        playerClassLabelText: createStatefulTextMock(),
        hpLabelText: createStatefulTextMock(),
        armorLabelText: createStatefulTextMock(),
        energyLabelText,
        goldLabelText: createStatefulTextMock(),
        statusLineText: createStatefulTextMock(),
        statsLineText: createStatefulTextMock(),
        skillCdText: createStatefulTextMock(),
        dashCdText: createStatefulTextMock(),
        skillLabelText: createStatefulTextMock(),
        dashLabelText: createStatefulTextMock(),
        weaponSlotBgs: slotBgs,
        weaponIconSprites: iconSprites,
        weaponKeyTexts: keyTexts,
        weaponNameTexts: nameTexts,
        weaponMetaTexts: metaTexts,
        invalidateAllHudCaches: vi.fn(),
        transport: { getSim: () => sim },
      } as unknown as GameScene;

      // Frame 1: initial build of bottom-right weapon slot cards
      sim.tick = 12;
      updateVectorHudImpl.call(scene);
      expect(slotBgs[0]!.clear).toHaveBeenCalledTimes(1);
      expect(slotBgs[1]!.clear).toHaveBeenCalledTimes(1);

      for (const idx of [0, 1] as const) {
        slotBgs[idx]!.clear.mockClear();
        keyTexts[idx]!.setText.mockClear();
        keyTexts[idx]!.setColor.mockClear();
        nameTexts[idx]!.setText.mockClear();
        nameTexts[idx]!.setColor.mockClear();
        metaTexts[idx]!.setText.mockClear();
        metaTexts[idx]!.setColor.mockClear();
      }
      energyLabelText.setText.mockClear();

      // Mutate cadence state across multiple frames without changing slots, active slot, keybindings, or locale
      const cadenceMutations: Array<() => void> = [
        () => {
          p.clipAmmo = Math.max(0, clipWeapon.clipSize - 1);
        },
        () => {
          p.clipAmmo = 1;
          p.weaponHeat = 45;
        },
        () => {
          p.reloadTimer = 0.65;
          p.weaponHeat = 82;
        },
        () => {
          p.reloadTimer = 0;
          p.overclockedNextShot = true;
          p.meleeComboStep = 2;
        },
      ];

      for (let step = 0; step < cadenceMutations.length; step++) {
        sim.tick = (step + 2) * 12;
        cadenceMutations[step]!();
        updateVectorHudImpl.call(scene);
      }

      // Top-left cadence bar text updated, proving HUD ran
      expect(energyLabelText.setText.mock.calls.length).toBeGreaterThan(0);

      // Bottom-right weapon slot cards must NOT clear/redraw or re-upload text/color
      for (const idx of [0, 1] as const) {
        expect(slotBgs[idx]!.clear).toHaveBeenCalledTimes(0);
        expect(keyTexts[idx]!.setText).toHaveBeenCalledTimes(0);
        expect(keyTexts[idx]!.setColor).toHaveBeenCalledTimes(0);
        expect(nameTexts[idx]!.setText).toHaveBeenCalledTimes(0);
        expect(nameTexts[idx]!.setColor).toHaveBeenCalledTimes(0);
        expect(metaTexts[idx]!.setText).toHaveBeenCalledTimes(0);
        expect(metaTexts[idx]!.setColor).toHaveBeenCalledTimes(0);
      }

      // Switching activeWeaponSlot DOES rebuild the weapon cards
      p.activeWeaponSlot = 1;
      sim.tick = 120;
      updateVectorHudImpl.call(scene);
      expect(slotBgs[0]!.clear).toHaveBeenCalledTimes(1);
      expect(slotBgs[1]!.clear).toHaveBeenCalledTimes(1);
    });
  });

  describe('4. SecretArenaHud: guards titleText.setColor and primaryText.setColor while countdown ticks', () => {
    it('does not call titleText.setColor or primaryText.setColor on frames 2-10 when progressRatio ticks with unchanged colors', () => {
      i18n.setLocale('vi');
      const sim = new WorldSim({ seed: 303, startInHub: false });
      sim.inHub = false;
      sim.runState = 'playing';
      sim.secretTrialActive = true;
      sim.secretTrialResult = 'active';
      sim.secretTrialRemainingEnemies = 4;
      sim.secretTrialTimer = 18.0;

      const createdTexts: Array<ReturnType<typeof createStatefulTextMock>> = [];
      const containerChildren: unknown[] = [];
      const makeContainer = () => {
        const c = {
          scene: {},
          active: true,
          visible: false,
          y: 0,
          add: vi.fn((items: unknown) => {
            if (Array.isArray(items)) containerChildren.push(...items);
            else containerChildren.push(items);
            return c;
          }),
          setVisible: vi.fn((v: boolean) => {
            c.visible = v;
            return c;
          }),
          setY: vi.fn((y: number) => {
            c.y = y;
            return c;
          }),
        };
        return c;
      };

      const uiScene = {
        cameras: { main: { zoom: 2 } },
        add: {
          container: vi.fn(() => makeContainer()),
          graphics: vi.fn(() => createNoopGraphics()),
          text: vi.fn((_x: number, _y: number, initText: string, style?: { color?: string }) => {
            const t = createStatefulTextMock(initText, style?.color ?? '#FFFFFF', true);
            createdTexts.push(t);
            return t;
          }),
        },
      };

      const scene = {
        fullMapOpen: false,
        uiScene,
        hudTopCenterContainer: makeContainer(),
        textObjects: [],
        transport: { getSim: () => sim },
      } as unknown as GameScene;

      expect(syncSecretArenaHud).toBe(renderSecretArenaCountdownHud);

      // Frame 1 at 18.0s (non-urgent: > 5.0s)
      syncSecretArenaHud(scene);
      expect(createdTexts).toHaveLength(2);
      const [titleText, primaryText] = createdTexts as [
        ReturnType<typeof createStatefulTextMock>,
        ReturnType<typeof createStatefulTextMock>,
      ];

      titleText.setText.mockClear();
      titleText.setColor.mockClear();
      primaryText.setText.mockClear();
      primaryText.setColor.mockClear();

      // Frames 2-10: tick secretTrialTimer from 17.8s down to 16.2s (progressRatio & primaryText change each frame; colors stay non-urgent)
      for (let frame = 2; frame <= 10; frame++) {
        sim.secretTrialTimer = 18.0 - (frame - 1) * 0.2;
        syncSecretArenaHud(scene);
      }

      expect(titleText.setText).toHaveBeenCalledTimes(0);
      expect(titleText.setColor).toHaveBeenCalledTimes(0);
      expect(primaryText.setColor).toHaveBeenCalledTimes(0);
      expect(primaryText.setText).toHaveBeenCalledTimes(9);
    });
  });

  describe('5. updateDebugStateImpl: caches computeMvpAwards during playing and recomputes immediately on victory', () => {
    it('calls sim.computeMvpAwards at most once across 10 playing frames with unchanged kills, and recomputes immediately on victory', () => {
      const sim = new WorldSim({ seed: 404, startInHub: false });
      sim.inHub = false;
      sim.runState = 'playing';
      sim.tick = 10;
      sim.runStats.kills = 6;

      const mvpSpy = vi.spyOn(sim, 'computeMvpAwards');

      const scene = {
        coopMode: 'solo',
        coopBackend: 'colyseus',
        preferredCoopTransport: 'lan',
        fullMapOpen: false,
        pauseModalOpen: false,
        pauseConfirmExitOpen: false,
        invitePanelVisible: false,
        displayName: 'Tester',
        serverHostPort: '127.0.0.1:2567',
        menuActiveInput: null,
        emoteWheelOpen: false,
        irisTransitionProgress: 0,
        trailingHpRatio: 1,
        trailingArmorRatio: 1,
        propVisuals: new Map(),
        activeEnemyIds: new Set<number>(),
        networkTransport: null,
        cameras: {
          main: {
            midPoint: { x: 240, y: 180 },
          },
        },
        lighting: {
          getActiveLightCount: () => 3,
          isBlizzardVeilActive: () => false,
        },
        fx: {
          getActiveDamagePopupCount: () => 2,
          getActiveDecalCount: () => 1,
          getActiveParticleCount: () => 7,
          getActiveAfterimageCount: () => 0,
          getActiveAmbientCount: () => 4,
          totalDamagePopupsSpawned: 5,
          totalSparksSpawned: 12,
          totalHitStopsTriggered: 1,
          totalShakesTriggered: 2,
        },
        transport: { getSim: () => sim },
      } as unknown as GameScene;

      // 10 consecutive frames during 'playing' with unchanged kill count
      for (let i = 0; i < 10; i++) {
        sim.tick = 10 + i;
        updateDebugStateImpl.call(scene, sim.player.x, sim.player.y);
      }

      const debug = initGlobalDebugState();
      expect(mvpSpy.mock.calls.length).toBeLessThanOrEqual(1);
      expect(mvpSpy).toHaveBeenCalledTimes(1);
      expect(debug.particleCount).toBe(7);
      expect(debug.damagePopupCount).toBe(2);

      // Kill count changes before 15-tick cooldown -> still throttled during 'playing'
      sim.runStats.kills = 7;
      sim.tick = 20; // 20 - 10 = 10 < 15
      updateDebugStateImpl.call(scene, sim.player.x, sim.player.y);
      expect(mvpSpy).toHaveBeenCalledTimes(1);

      // Once >= 15 ticks have elapsed since last eval, playing state refreshes cached MVP count
      sim.tick = 25; // 25 - 10 = 15 >= 15
      updateDebugStateImpl.call(scene, sim.player.x, sim.player.y);
      expect(mvpSpy).toHaveBeenCalledTimes(2);

      // Transition to 'victory' on the very next tick (tickDelta = 1, unchanged kills) -> recomputes immediately!
      sim.runState = 'victory';
      sim.tick = 26;
      updateDebugStateImpl.call(scene, sim.player.x, sim.player.y);
      expect(mvpSpy).toHaveBeenCalledTimes(3);
      expect(debug.mvpAwardsCount).toBe(sim.computeMvpAwards().length);
    });
  });

  describe('6. FNV-1a minimap room topology hash & bossHintText / pactRelicHudText upload guards', () => {
    it('computes a deterministic uint32 FNV-1a hash over dungeon rooms that changes whenever room state changes', () => {
      const sim = new WorldSim({ seed: 505, startInHub: false });
      const h0 = computeRoomsTopologyHash(sim.dungeon.rooms);
      expect(Number.isInteger(h0)).toBe(true);
      expect(h0).toBeGreaterThanOrEqual(0);
      expect(computeRoomsTopologyHash(sim.dungeon.rooms)).toBe(h0);

      const target = sim.dungeon.rooms[0]!;
      const prevDiscovery = target.discovery;
      target.discovery = prevDiscovery === 'cleared' ? 'hidden' : 'cleared';
      const h1 = computeRoomsTopologyHash(sim.dungeon.rooms);
      expect(h1).not.toBe(h0);

      target.discovery = prevDiscovery;
      expect(computeRoomsTopologyHash(sim.dungeon.rooms)).toBe(h0);
    });

    it('guards bossHintText.setColor and pactRelicHudText.setColor across repeated HUD redraws with unchanged text and color', () => {
      const sim = new WorldSim({ seed: 606, startInHub: false });
      const boss = sim.spawnEnemy('spore_king', 300, 220, true);
      boss.isBoss = true;
      boss.bossArmorShellActive = true;

      const createdTexts: Array<ReturnType<typeof createStatefulTextMock>> = [];
      const uiScene = {
        scale: { width: 1920, height: 1080 },
        add: {
          text: vi.fn((_x: number, _y: number, initText: string, style?: { color?: string }) => {
            const t = createStatefulTextMock(initText, style?.color ?? '#FFFFFF', true);
            createdTexts.push(t);
            return t;
          }),
        },
      };
      const containerAdd = vi.fn();
      const scene = {
        currentHudUiScale: 1.0,
        uiScene,
        textObjects: [],
        hudTopCenterContainer: { add: containerAdd },
        hudTopLeftContainer: { add: containerAdd },
      } as unknown as GameScene;

      const g = createNoopGraphics() as unknown as Phaser.GameObjects.Graphics;

      // Boss tactical hint banner across 10 redraws
      drawBossArmorFrameAndTacticalHintHud(scene, g, boss, -174, 8, 348, 42, -148, 28, 312, 9);
      const bossHint = (scene as unknown as { bossHintText: ReturnType<typeof createStatefulTextMock> })
        .bossHintText;
      expect(bossHint).toBeDefined();
      bossHint.setText.mockClear();
      bossHint.setColor.mockClear();

      for (let i = 0; i < 9; i++) {
        drawBossArmorFrameAndTacticalHintHud(scene, g, boss, -174, 8, 348, 42, -148, 28, 312, 9);
      }
      expect(bossHint.setText).toHaveBeenCalledTimes(0);
      expect(bossHint.setColor).toHaveBeenCalledTimes(0);

      // Pact & Relic HUD pill across 10 redraws
      sim.player.activePactId = ALL_ASHEN_PACT_IDS[0]!;
      drawPlayerPactAndRelicHudBadges(scene, g, sim.player, 12, 102, false);
      const pactTxt = (
        scene as unknown as { pactRelicHudText: ReturnType<typeof createStatefulTextMock> }
      ).pactRelicHudText;
      expect(pactTxt).toBeDefined();
      pactTxt.setText.mockClear();
      pactTxt.setColor.mockClear();

      for (let i = 0; i < 9; i++) {
        drawPlayerPactAndRelicHudBadges(scene, g, sim.player, 12, 102, false);
      }
      expect(pactTxt.setText).toHaveBeenCalledTimes(0);
      expect(pactTxt.setColor).toHaveBeenCalledTimes(0);
    });
  });
});
