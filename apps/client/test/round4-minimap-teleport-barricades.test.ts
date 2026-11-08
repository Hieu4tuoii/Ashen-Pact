import {
  ENEMIES,
  type EnemyDefId,
  i18n,
  type InteractTargetResult,
  WORLD_VIEW_WIDTH,
  WorldSim,
} from '@ashen-pact/shared';
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
  class MockWebGLRenderer {
    public pipelines = {
      has: vi.fn(() => true),
      addPostPipeline: vi.fn(),
    };
  }
  class MockScene {
    constructor(_config?: unknown) {}
  }
  const PhaserMock = {
    Scene: MockScene,
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

import { PALETTE } from '../src/art/palette.js';
import { TextureBaker } from '../src/art/texture-baker.js';
import { bakeProps } from '../src/art/texture-baker-props.js';
import type { GameScene } from '../src/scenes/GameScene.js';
import { teleportToRoomImpl } from '../src/scenes/game-scene/arena-tiles.js';
import {
  canTeleportFromCurrentRoom,
  resolveMinimapClickedRoomId,
  resolveMinimapNodeDims,
  updateMinimapHudImpl,
} from '../src/scenes/game-scene/hud-combat-and-coop.js';
import { resolveInteractPromptSpec } from '../src/scenes/game-scene/interact-prompt.js';
import { renderTelegraphsAndShieldImpl } from '../src/scenes/game-scene/telegraphs-and-overlays.js';
import { graphicsSettings } from '../src/ui/graphics-settings.js';
import { UI_THEME } from '../src/ui/theme.js';

function createMockGraphics() {
  const ops: Array<{ op: string; args: number[] }> = [];
  return {
    ops,
    clear: vi.fn(() => {
      ops.length = 0;
    }),
    fillStyle: vi.fn((color: number, alpha = 1) => {
      ops.push({ op: 'fillStyle', args: [color, alpha] });
    }),
    lineStyle: vi.fn((width: number, color: number, alpha = 1) => {
      ops.push({ op: 'lineStyle', args: [width, color, alpha] });
    }),
    fillRect: vi.fn((x: number, y: number, w: number, h: number) => {
      ops.push({ op: 'fillRect', args: [x, y, w, h] });
    }),
    strokeRect: vi.fn((x: number, y: number, w: number, h: number) => {
      ops.push({ op: 'strokeRect', args: [x, y, w, h] });
    }),
    fillRoundedRect: vi.fn((x: number, y: number, w: number, h: number, r: number) => {
      ops.push({ op: 'fillRoundedRect', args: [x, y, w, h, r] });
    }),
    strokeRoundedRect: vi.fn((x: number, y: number, w: number, h: number, r: number) => {
      ops.push({ op: 'strokeRoundedRect', args: [x, y, w, h, r] });
    }),
    fillCircle: vi.fn((x: number, y: number, r: number) => {
      ops.push({ op: 'fillCircle', args: [x, y, r] });
    }),
    strokeCircle: vi.fn((x: number, y: number, r: number) => {
      ops.push({ op: 'strokeCircle', args: [x, y, r] });
    }),
    fillEllipse: vi.fn((x: number, y: number, w: number, h: number) => {
      ops.push({ op: 'fillEllipse', args: [x, y, w, h] });
    }),
    strokeEllipse: vi.fn((x: number, y: number, w: number, h: number) => {
      ops.push({ op: 'strokeEllipse', args: [x, y, w, h] });
    }),
    beginPath: vi.fn(() => {
      ops.push({ op: 'beginPath', args: [] });
    }),
    moveTo: vi.fn((x: number, y: number) => {
      ops.push({ op: 'moveTo', args: [x, y] });
    }),
    lineTo: vi.fn((x: number, y: number) => {
      ops.push({ op: 'lineTo', args: [x, y] });
    }),
    arc: vi.fn((x: number, y: number, r: number, a0: number, a1: number) => {
      ops.push({ op: 'arc', args: [x, y, r, a0, a1] });
    }),
    closePath: vi.fn(() => {
      ops.push({ op: 'closePath', args: [] });
    }),
    fillPath: vi.fn(() => {
      ops.push({ op: 'fillPath', args: [] });
    }),
    strokePath: vi.fn(() => {
      ops.push({ op: 'strokePath', args: [] });
    }),
  };
}

interface RecordedBakerCanvas {
  width: number;
  height: number;
  ops: Array<{
    op: string;
    args: number[];
    fillStyle: string | object;
    strokeStyle: string | object;
  }>;
  fillStyles: string[];
  strokeStyles: string[];
}

function withMockBakerScene<T>(
  fn: (scene: Phaser.Scene, baked: Map<string, RecordedBakerCanvas>) => T,
): T {
  const baked = new Map<string, RecordedBakerCanvas>();
  const prevDoc = (globalThis as { document?: unknown }).document;

  const createCtx = (rec: RecordedBakerCanvas): CanvasRenderingContext2D => {
    let curFill: string | object = '#000000';
    let curStroke: string | object = '#000000';
    const stack: Array<{ fill: string | object; stroke: string | object }> = [];
    const ctx = {
      get fillStyle() {
        return curFill;
      },
      set fillStyle(v: string | object) {
        curFill = v;
        if (typeof v === 'string') rec.fillStyles.push(v.toUpperCase());
      },
      get strokeStyle() {
        return curStroke;
      },
      set strokeStyle(v: string | object) {
        curStroke = v;
        if (typeof v === 'string') rec.strokeStyles.push(v.toUpperCase());
      },
      lineWidth: 1,
      lineCap: 'round',
      lineJoin: 'round',
      globalAlpha: 1,
      globalCompositeOperation: 'source-over',
      save: () => stack.push({ fill: curFill, stroke: curStroke }),
      restore: () => {
        const s = stack.pop();
        if (s) {
          curFill = s.fill;
          curStroke = s.stroke;
        }
      },
      scale: () => {},
      translate: () => {},
      rotate: (ang: number) =>
        rec.ops.push({ op: 'rotate', args: [ang], fillStyle: curFill, strokeStyle: curStroke }),
      beginPath: () =>
        rec.ops.push({ op: 'beginPath', args: [], fillStyle: curFill, strokeStyle: curStroke }),
      closePath: () =>
        rec.ops.push({ op: 'closePath', args: [], fillStyle: curFill, strokeStyle: curStroke }),
      moveTo: (x: number, y: number) =>
        rec.ops.push({ op: 'moveTo', args: [x, y], fillStyle: curFill, strokeStyle: curStroke }),
      lineTo: (x: number, y: number) =>
        rec.ops.push({ op: 'lineTo', args: [x, y], fillStyle: curFill, strokeStyle: curStroke }),
      quadraticCurveTo: (cpx: number, cpy: number, x: number, y: number) =>
        rec.ops.push({
          op: 'quadraticCurveTo',
          args: [cpx, cpy, x, y],
          fillStyle: curFill,
          strokeStyle: curStroke,
        }),
      bezierCurveTo: (
        cp1x: number,
        cp1y: number,
        cp2x: number,
        cp2y: number,
        x: number,
        y: number,
      ) =>
        rec.ops.push({
          op: 'bezierCurveTo',
          args: [cp1x, cp1y, cp2x, cp2y, x, y],
          fillStyle: curFill,
          strokeStyle: curStroke,
        }),
      arc: (x: number, y: number, r: number) =>
        rec.ops.push({ op: 'arc', args: [x, y, r], fillStyle: curFill, strokeStyle: curStroke }),
      arcTo: (x1: number, y1: number, x2: number, y2: number, r: number) =>
        rec.ops.push({
          op: 'arcTo',
          args: [x1, y1, x2, y2, r],
          fillStyle: curFill,
          strokeStyle: curStroke,
        }),
      ellipse: (x: number, y: number, rx: number, ry: number) =>
        rec.ops.push({
          op: 'ellipse',
          args: [x, y, rx, ry],
          fillStyle: curFill,
          strokeStyle: curStroke,
        }),
      rect: (x: number, y: number, w: number, h: number) =>
        rec.ops.push({
          op: 'rect',
          args: [x, y, w, h],
          fillStyle: curFill,
          strokeStyle: curStroke,
        }),
      fillRect: (x: number, y: number, w: number, h: number) =>
        rec.ops.push({
          op: 'fillRect',
          args: [x, y, w, h],
          fillStyle: curFill,
          strokeStyle: curStroke,
        }),
      strokeRect: (x: number, y: number, w: number, h: number) =>
        rec.ops.push({
          op: 'strokeRect',
          args: [x, y, w, h],
          fillStyle: curFill,
          strokeStyle: curStroke,
        }),
      clearRect: () => {},
      fill: () =>
        rec.ops.push({ op: 'fill', args: [], fillStyle: curFill, strokeStyle: curStroke }),
      stroke: () =>
        rec.ops.push({ op: 'stroke', args: [], fillStyle: curFill, strokeStyle: curStroke }),
      clip: () =>
        rec.ops.push({ op: 'clip', args: [], fillStyle: curFill, strokeStyle: curStroke }),
      createLinearGradient: () => ({ addColorStop: () => {} }),
      createRadialGradient: () => ({ addColorStop: () => {} }),
    };
    return ctx as unknown as CanvasRenderingContext2D;
  };

  (globalThis as { document?: unknown }).document = {
    createElement(tag: string) {
      if (tag !== 'canvas') throw new Error(`Unexpected tag: ${tag}`);
      const rec: RecordedBakerCanvas = {
        width: 0,
        height: 0,
        ops: [],
        fillStyles: [],
        strokeStyles: [],
      };
      const ctx = createCtx(rec);
      return {
        get width() {
          return rec.width;
        },
        set width(w: number) {
          rec.width = w;
        },
        get height() {
          return rec.height;
        },
        set height(h: number) {
          rec.height = h;
        },
        __rec: rec,
        getContext(kind: string) {
          return kind === '2d' ? ctx : null;
        },
      };
    },
  };

  const scene = {
    textures: {
      exists: (key: string) => baked.has(key),
      remove: (key: string) => {
        baked.delete(key);
      },
      addCanvas: (key: string, canvas: { __rec: RecordedBakerCanvas }) => {
        baked.set(key, canvas.__rec);
      },
      createCanvas: (key: string, width = 32, height = 32) => {
        const rec: RecordedBakerCanvas = {
          width,
          height,
          ops: [],
          fillStyles: [],
          strokeStyles: [],
        };
        const ctx = createCtx(rec);
        baked.set(key, rec);
        return { width, height, context: ctx, getContext: () => ctx, refresh: () => {} };
      },
    },
  } as unknown as Phaser.Scene;

  try {
    return fn(scene, baked);
  } finally {
    if (prevDoc === undefined) {
      delete (globalThis as { document?: unknown }).document;
    } else {
      (globalThis as { document?: unknown }).document = prevDoc;
    }
  }
}

describe('Round 4 — Entered-Only Minimap Fog-of-War, Fast-Travel Teleportation & Vector Barricades (F23, F24, F25)', () => {
  describe('F23: Entered-Only Minimap & [Tab] Map Fog-of-War', () => {
    it('hides hidden and discovered rooms and unvisited corridors in both compact and [Tab] Full Map modes while keeping player gold dot as final fillCircle', () => {
      const sim = new WorldSim({ seed: 2026, biome: 1 });
      sim.enterRoom(sim.dungeon.startRoomId);
      const startRoom = sim.getCurrentRoom()!;

      // Ensure startRoom has at least one neighbor; leave all neighbors in 'discovered' or 'hidden'
      for (const r of sim.dungeon.rooms) {
        if (r.id !== startRoom.id) {
          r.discovery = r.id % 2 === 0 ? 'discovered' : 'hidden';
        }
      }

      const g = createMockGraphics();
      const mockScene = {
        fullMapOpen: false,
        hudPadX: 0,
        hudPadY: 0,
        lastMinimapHash: '',
        minimapGraphics: g,
        minimapTitleText: {
          text: '',
          setText: vi.fn(function (this: { text: string }, t: string) {
            this.text = t;
          }),
          setColor: vi.fn(),
          setOrigin: vi.fn(),
          setPosition: vi.fn(),
          setVisible: vi.fn(),
        },
        transport: {
          getSim: () => sim,
        },
      } as unknown as GameScene;

      const countCorridorRects = () => {
        let count = 0;
        for (let i = 1; i < g.ops.length; i++) {
          const prev = g.ops[i - 1]!;
          const cur = g.ops[i]!;
          if (
            prev.op === 'fillStyle' &&
            prev.args[0] === UI_THEME.panelBorderHighlight &&
            Math.abs(prev.args[1]! - 0.82) < 1e-4 &&
            cur.op === 'fillRect'
          ) {
            count++;
          }
        }
        return count;
      };

      const countRoomSilhouettes = () =>
        g.ops.filter(
          (o) =>
            o.op === 'lineStyle' &&
            (o.args[1] === 0xfacc15 || o.args[1] === UI_THEME.panelBorderHighlight),
        ).length;

      // 1) Compact mode with only startRoom entered -> 1 room silhouette, 0 corridors
      updateMinimapHudImpl.call(mockScene);
      expect(countRoomSilhouettes()).toBe(1);
      expect(countCorridorRects()).toBe(0);

      // Player gold dot is the final fillCircle
      const fillCirclesCompact = g.ops.filter((o) => o.op === 'fillCircle');
      expect(fillCirclesCompact.length).toBeGreaterThanOrEqual(2);
      const lastFillStyleBeforeDot = (() => {
        for (let i = g.ops.length - 1; i >= 1; i--) {
          if (g.ops[i]!.op === 'fillCircle') {
            return g.ops[i - 1]!;
          }
        }
        return null;
      })();
      expect(lastFillStyleBeforeDot?.op).toBe('fillStyle');
      expect(lastFillStyleBeforeDot?.args[0]).toBe(UI_THEME.status.goldBright);

      // 2) Full Map mode with only startRoom entered -> still 1 room silhouette, 0 corridors
      mockScene.fullMapOpen = true;
      mockScene.lastMinimapHash = '';
      updateMinimapHudImpl.call(mockScene);
      expect(countRoomSilhouettes()).toBe(1);
      expect(countCorridorRects()).toBe(0);

      // 3) Mark one connected neighbor as 'visited' and another unconnected/distant room as 'discovered'
      const neighborId = Object.values(startRoom.connections).find((id) => id !== undefined)!;
      const neighborRoom = sim.dungeon.rooms[neighborId]!;
      neighborRoom.discovery = 'visited';
      neighborRoom.cleared = true;
      startRoom.cleared = true;
      sim.enemies.length = 0;

      mockScene.lastMinimapHash = '';
      updateMinimapHudImpl.call(mockScene);

      // Now exactly 2 rooms (startRoom + neighborRoom) and their connecting corridor render
      expect(countRoomSilhouettes()).toBe(2);
      expect(countCorridorRects()).toBeGreaterThanOrEqual(1);

      // Fast-travel ready cyan strokeRect is drawn in Full Map mode for the visited neighbor room
      const cyanTeleportOutlines = g.ops.filter(
        (o, idx) =>
          o.op === 'strokeRect' &&
          g.ops[idx - 1]?.op === 'lineStyle' &&
          g.ops[idx - 1]?.args[1] === 0x38bdf8,
      );
      expect(cyanTeleportOutlines.length).toBe(1);

      // And player gold dot remains the final fillCircle
      for (let i = g.ops.length - 1; i >= 1; i--) {
        if (g.ops[i]!.op === 'fillCircle') {
          expect(g.ops[i - 1]?.args[0]).toBe(UI_THEME.status.goldBright);
          break;
        }
      }
    });
  });

  describe('F24: Fast-Travel Room Teleportation, Coordinate Hit-Testing & Teleport VFX', () => {
    it('validates canTeleportFromCurrentRoom across hub, death, uncleared room, active enemies, secret trial, and locked doors', () => {
      const sim = new WorldSim({ seed: 4242, biome: 1 });

      // In hub -> false
      sim.enterHub();
      expect(canTeleportFromCurrentRoom(sim)).toBe(false);

      // Enter start room (cleared, no enemies) -> true
      sim.enterRoom(sim.dungeon.startRoomId);
      const room = sim.getCurrentRoom()!;
      room.cleared = true;
      sim.enemies.length = 0;
      for (const d of sim.doors) d.locked = false;
      expect(canTeleportFromCurrentRoom(sim)).toBe(true);

      // Dead or downed player -> false
      sim.player.lifeState = 'dead';
      expect(canTeleportFromCurrentRoom(sim)).toBe(false);
      sim.player.lifeState = 'alive';
      expect(canTeleportFromCurrentRoom(sim)).toBe(true);

      // Room not cleared -> false
      room.cleared = false;
      expect(canTeleportFromCurrentRoom(sim)).toBe(false);
      room.cleared = true;

      // Secret trial active -> false
      sim.secretTrialActive = true;
      expect(canTeleportFromCurrentRoom(sim)).toBe(false);
      sim.secretTrialActive = false;

      // Locked non-secret door -> false; locked secret passage -> still true
      if (sim.doors.length > 0) {
        sim.doors[0]!.isSecretPassage = true;
        sim.doors[0]!.locked = true;
        expect(canTeleportFromCurrentRoom(sim)).toBe(true);

        sim.doors[0]!.isSecretPassage = false;
        expect(canTeleportFromCurrentRoom(sim)).toBe(false);
        sim.doors[0]!.locked = false;
      }

      // Active combat enemy -> false
      const combatEnemyId = (Object.keys(ENEMIES).find((k) => k !== 'training_dummy') ??
        Object.keys(ENEMIES)[0]!) as EnemyDefId;
      sim.spawnEnemy(combatEnemyId, sim.player.x + 120, sim.player.y);
      expect(canTeleportFromCurrentRoom(sim)).toBe(false);
      sim.enemies.length = 0;
      expect(canTeleportFromCurrentRoom(sim)).toBe(true);
    });

    it('resolves clicked visited/cleared room IDs in compact and Full Map modes across uiScale and hudPadX/Y while ignoring unvisited rooms', () => {
      const sim = new WorldSim({ seed: 5150, biome: 1 });
      sim.enterRoom(sim.dungeon.startRoomId);
      const startRoom = sim.getCurrentRoom()!;
      const neighborId = Object.values(startRoom.connections).find((id) => id !== undefined)!;
      const neighborRoom = sim.dungeon.rooms[neighborId]!;
      neighborRoom.discovery = 'cleared';

      const unvisitedRoom = sim.dungeon.rooms.find(
        (r) => r.id !== startRoom.id && r.id !== neighborRoom.id,
      )!;
      unvisitedRoom.discovery = 'discovered';

      const rooms = sim.dungeon.rooms;
      let minGx = 99;
      let maxGx = -99;
      let minGy = 99;
      let maxGy = -99;
      for (const r of rooms) {
        if (r.gx < minGx) minGx = r.gx;
        if (r.gx > maxGx) maxGx = r.gx;
        if (r.gy < minGy) minGy = r.gy;
        if (r.gy > maxGy) maxGy = r.gy;
      }
      const spanX = Math.max(1, maxGx - minGx + 1);
      const spanY = Math.max(1, maxGy - minGy + 1);

      const computeViewPtForRoom = (
        rm: typeof startRoom,
        fullMapOpen: boolean,
        uiScale: number,
        padX: number,
        padY: number,
      ) => {
        const panelW = fullMapOpen ? 420 : 172;
        const panelH = fullMapOpen ? 280 : 102;
        const panelX = fullMapOpen ? -480 - panelW * 0.5 : -184;
        const panelY = fullMapOpen ? 110 : 10;
        const cellStep = fullMapOpen
          ? Math.min(52, Math.floor((panelW - 56) / spanX), Math.floor((panelH - 52) / spanY))
          : Math.min(24, Math.floor((panelW - 24) / spanX), Math.floor((panelH - 22) / spanY));
        const originX = panelX + (panelW - (spanX - 1) * cellStep) * 0.5;
        const originY = panelY + (panelH - (spanY - 1) * cellStep) * 0.5;
        const cx = originX + (rm.gx - minGx) * cellStep;
        const cy = originY + (rm.gy - minGy) * cellStep;
        return {
          viewX: cx * uiScale + WORLD_VIEW_WIDTH + padX,
          viewY: cy * uiScale - padY,
          cellStep,
        };
      };

      const prevScale = graphicsSettings.getState().uiScale;
      try {
        for (const [fullMapOpen, uiScale, padX, padY] of [
          [false, 1.0, 0, 0],
          [true, 1.0, 0, 0],
          [true, 1.15, 24, 16],
          [false, 0.9, 12, 8],
        ] as const) {
          graphicsSettings.setUiScale(uiScale);
          const mockScene = {
            transport: { getSim: () => sim },
            fullMapOpen,
            hudPadX: padX,
            hudPadY: padY,
            currentHudUiScale: uiScale,
          };

          const ptNeighbor = computeViewPtForRoom(neighborRoom, fullMapOpen, uiScale, padX, padY);
          expect(resolveMinimapClickedRoomId(mockScene, ptNeighbor.viewX, ptNeighbor.viewY)).toBe(
            neighborRoom.id,
          );

          const ptStart = computeViewPtForRoom(startRoom, fullMapOpen, uiScale, padX, padY);
          expect(resolveMinimapClickedRoomId(mockScene, ptStart.viewX, ptStart.viewY)).toBe(
            startRoom.id,
          );

          // Unvisited ('discovered') room must NOT resolve
          const ptUnvisited = computeViewPtForRoom(unvisitedRoom, fullMapOpen, uiScale, padX, padY);
          expect(
            resolveMinimapClickedRoomId(mockScene, ptUnvisited.viewX, ptUnvisited.viewY),
          ).toBeNull();

          // Outside panel click -> null
          expect(resolveMinimapClickedRoomId(mockScene, 20, 20)).toBeNull();
        }
      } finally {
        graphicsSettings.setUiScale(prevScale);
      }
    });

    it('executes teleportToRoom on valid visited/cleared rooms, syncs Co-op teleport_room, triggers departure/arrival VFX, and animates arrival rings', () => {
      const sim = new WorldSim({ seed: 7777, biome: 1 });
      sim.enterRoom(sim.dungeon.startRoomId);
      const startRoom = sim.getCurrentRoom()!;
      startRoom.cleared = true;
      sim.enemies.length = 0;

      const neighborId = Object.values(startRoom.connections).find((id) => id !== undefined)!;
      const neighborRoom = sim.dungeon.rooms[neighborId]!;
      neighborRoom.discovery = 'visited';
      neighborRoom.cleared = true;

      const hiddenRoom = sim.dungeon.rooms.find(
        (r) => r.id !== startRoom.id && r.id !== neighborRoom.id,
      )!;
      hiddenRoom.discovery = 'discovered';

      const spawnShaderNova = vi.fn();
      const spawnChestOpenBurst = vi.fn();
      const addTrauma = vi.fn();
      const spawnFloatingAlert = vi.fn();
      const spawnTransientLight = vi.fn();
      const roomSend = vi.fn();

      const mockScene = {
        coopMode: 'host' as const,
        room: { send: roomSend },
        fullMapOpen: true,
        irisTransitionDir: 0 as -1 | 0 | 1,
        irisTransitionProgress: 0,
        roomTeleportAnimTimer: 0,
        roomTeleportAnimDuration: 0.28,
        lastMinimapHash: 'cached',
        fx: {
          spawnShaderNova,
          spawnChestOpenBurst,
          addTrauma,
          spawnFloatingAlert,
        },
        lighting: {
          spawnTransientLight,
        },
        transport: {
          getSim: () => sim,
          consumeEvents: () => sim.consumeEvents(),
        },
        processSimEvents: vi.fn(),
      } as unknown as GameScene;

      // 1) Reject teleport to current room or unvisited ('discovered') room
      expect(teleportToRoomImpl.call(mockScene, startRoom.id)).toBe(false);
      expect(teleportToRoomImpl.call(mockScene, hiddenRoom.id)).toBe(false);

      // 2) Reject teleport while in combat (room not cleared)
      startRoom.cleared = false;
      expect(teleportToRoomImpl.call(mockScene, neighborRoom.id)).toBe(false);
      startRoom.cleared = true;

      // 3) Succeed on valid visited/cleared target room
      i18n.setLocale('vi');
      const ok = teleportToRoomImpl.call(mockScene, neighborRoom.id);
      expect(ok).toBe(true);
      expect(sim.currentRoomId).toBe(neighborRoom.id);
      expect(sim.doorTransitionCooldown).toBeGreaterThanOrEqual(0.75);
      expect(mockScene.fullMapOpen).toBe(false);
      expect(mockScene.irisTransitionDir).toBe(-1);
      expect(mockScene.roomTeleportAnimTimer).toBeCloseTo(0.28, 5);
      expect(roomSend).toHaveBeenCalledWith('teleport_room', { roomId: neighborRoom.id });

      // Departure + Arrival VFX calls
      expect(spawnShaderNova).toHaveBeenCalledTimes(2);
      expect(spawnShaderNova.mock.calls[0]?.[3]).toBe('fx_sh_arcane_sigil');
      expect(spawnShaderNova.mock.calls[1]?.[3]).toBe('fx_sh_arcane_sigil');
      expect(spawnChestOpenBurst).toHaveBeenCalledWith(sim.player.x, sim.player.y, 'rare');
      expect(spawnTransientLight).toHaveBeenCalledTimes(2);
      expect(addTrauma).toHaveBeenCalledWith(0.2);
      expect(spawnFloatingAlert).toHaveBeenCalledWith(
        sim.player.x,
        sim.player.y - 18,
        '⚡ DỊCH CHUYỂN!',
        PALETTE.CYAN_FROST,
      );

      // 4) Verify arrival rings render in renderTelegraphsAndShieldImpl while roomTeleportAnimTimer > 0
      const telegraphG = createMockGraphics();
      const floorG = createMockGraphics();
      const overlayScene = {
        ...mockScene,
        telegraphGraphics: telegraphG,
        groundHazardGraphics: floorG,
        cameras: { main: { worldView: { x: 0, y: 0, width: 960, height: 540 } } },
        entityPosScratch: { x: 0, y: 0 },
      } as unknown as GameScene;

      renderTelegraphsAndShieldImpl.call(overlayScene, sim.player.x, sim.player.y);
      expect(floorG.ops.some((o) => o.op === 'strokeCircle')).toBe(true);
      expect(telegraphG.ops.some((o) => o.op === 'strokeCircle')).toBe(true);
    });
  });

  describe('F25: Procedural Vector Biome Barricades & [E] Prompt Removal', () => {
    it('returns null for flip_cover in resolveInteractPromptSpec', () => {
      const sim = new WorldSim({ seed: 101, biome: 1 });
      const flipTarget = {
        kind: 'flip_cover',
        key: 'flip_cover:1',
        x: 200,
        y: 200,
        distance: 24,
        prop: {
          id: 1,
          kind: 'moss_table',
          x: 200,
          y: 200,
          radius: 18,
          hp: 60,
          maxHp: 60,
          destructible: false,
          explosive: false,
          blocksMovement: false,
          state: 'intact',
          coverState: 'low',
        },
      } as unknown as InteractTargetResult;

      expect(resolveInteractPromptSpec(sim, flipTarget)).toBeNull();
    });

    it('bakes rich multi-polygon vector biome objects for all 9 barricade texture keys across Biomes 1, 2, and 3', () => {
      withMockBakerScene((scene, baked) => {
        bakeProps(scene, 4);

        const biome1Keys = [
          'prop_moss_table',
          'prop_moss_table_flipped',
          'prop_moss_table_sliding',
        ] as const;
        const biome2Keys = [
          'prop_glacial_barricade',
          'prop_glacial_barricade_flipped',
          'prop_glacial_barricade_sliding',
        ] as const;
        const biome3Keys = [
          'prop_forge_blast_shield',
          'prop_forge_blast_shield_flipped',
          'prop_forge_blast_shield_sliding',
        ] as const;

        for (const key of [...biome1Keys, ...biome2Keys, ...biome3Keys]) {
          const rec = baked.get(key);
          expect(rec, `Missing baked texture for ${key}`).toBeDefined();
          const lineToCount = rec!.ops.filter((o) => o.op === 'lineTo').length;
          const fillCount = rec!.ops.filter((o) => o.op === 'fill').length;
          const strokeCount = rec!.ops.filter((o) => o.op === 'stroke').length;

          expect(lineToCount, `${key} should have >= 10 lineTo ops`).toBeGreaterThanOrEqual(10);
          expect(fillCount, `${key} should have >= 3 fill ops`).toBeGreaterThanOrEqual(3);
          expect(strokeCount, `${key} should have >= 2 stroke ops`).toBeGreaterThanOrEqual(2);
        }

        // Verify biome-authentic palette colors
        for (const key of biome1Keys) {
          const rec = baked.get(key)!;
          const styles = [...rec.fillStyles, ...rec.strokeStyles];
          expect(styles).toContain(PALETTE.GOBLIN_GREEN.toUpperCase());
          expect(styles).toContain(PALETTE.LIME_GLOW.toUpperCase());
        }

        for (const key of biome2Keys) {
          const rec = baked.get(key)!;
          const styles = [...rec.fillStyles, ...rec.strokeStyles];
          expect(styles).toContain(PALETTE.COBALT_SHADE.toUpperCase());
          expect(styles).toContain(PALETTE.ICE_WHITE.toUpperCase());
        }

        for (const key of biome3Keys) {
          const rec = baked.get(key)!;
          const styles = [...rec.fillStyles, ...rec.strokeStyles];
          expect(styles).toContain(PALETTE.BRASS_CORE.toUpperCase());
          expect(styles).toContain(PALETTE.SOLAR_GOLD.toUpperCase());
        }

        // Verify TextureBaker.getPropTextureKey contract remains intact
        expect(TextureBaker.getPropTextureKey('moss_table', 'low')).toBe('prop_moss_table');
        expect(TextureBaker.getPropTextureKey('moss_table', 'flipped')).toBe(
          'prop_moss_table_flipped',
        );
        expect(TextureBaker.getPropTextureKey('moss_table', 'sliding')).toBe(
          'prop_moss_table_sliding',
        );
        expect(TextureBaker.getPropTextureKey('glacial_barricade', 'low')).toBe(
          'prop_glacial_barricade',
        );
        expect(TextureBaker.getPropTextureKey('forge_blast_shield', 'low')).toBe(
          'prop_forge_blast_shield',
        );
      });
    });
  });
});
