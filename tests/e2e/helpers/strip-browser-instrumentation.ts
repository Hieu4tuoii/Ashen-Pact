import type { Page } from '@playwright/test';
import type {
  EmittedSimEventRecord,
  ExternalStateMutationRecord,
  FloatingAlertBoundsRecord,
  KeyframeTraceRecord,
  ScreenRect,
  StripStageKind,
  TrackedActorBoundsRecord,
} from '../../../tools/visual-metrics.js';

export interface WhitelistInputSpec {
  moveX?: number;
  moveY?: number;
  aimWorldX?: number;
  aimWorldY?: number;
  aimAngle?: number;
  fire?: boolean;
  dash?: boolean;
  interact?: boolean;
  reloadVent?: boolean;
  dropWeapon?: boolean;
  skill?: boolean;
  swapWeapon?: boolean;
  weaponSlotSelect?: number | null;
  durationTicks?: number;
}

export interface BrowserStripHarnessState {
  installed: boolean;
  captureActive: boolean;
  currentFrameIndex: number;
  rafStepCounter: number;
  postWarmupStartTick: number;
  lastPostStepStateHash: string | null;
  lastStepMaxWorldDispPx: number;
  emittedSimEvents: EmittedSimEventRecord[];
  externalStateMutations: ExternalStateMutationRecord[];
  inputQueue: Array<WhitelistInputSpec & { remainingTicks: number; firstTickPending: boolean }>;
  computeStateHash: () => string;
  collectKeyframeTrace: (
    frameIndex: number,
    stage: StripStageKind,
    customLabel: string | undefined,
    deltaTicks: number,
    rafStepsTaken: number,
    stateChangedInStep: boolean,
    includeProjectilesMode: 'none' | 'player_and_parried' | 'all_focused',
    enemyKinds?: readonly string[],
    propKinds?: readonly string[],
  ) => KeyframeTraceRecord;
}

export async function installSceneStripInstrumentation(page: Page): Promise<void> {
  await page.evaluate(() => {
    const win = window as unknown as {
      __STRIP_HARNESS__?: BrowserStripHarnessState;
      __STRIP_STEP_TICKS__?: number;
      __CAPTURE_STRIP_ACTIVE__?: boolean;
      __GAME_TRANSPORT__?: {
        getSim: () => Record<string, unknown>;
        step: (dt: number) => void;
        sendInput: (pkt: Record<string, unknown>) => void;
      };
      __PHASER_GAME__?: {
        scene: { getScene: (k: string) => Record<string, unknown> | undefined };
      };
    };

    const transport = win.__GAME_TRANSPORT__;
    const gs = win.__PHASER_GAME__?.scene.getScene('GameScene');
    if (!transport || !gs) return;
    const sim = transport.getSim() as {
      tick: number;
      map?: { getSurfaceAtWorld?: (x: number, y: number) => string };
      player: Record<string, unknown>;
      enemies: Array<Record<string, unknown>>;
      props: Array<Record<string, unknown>>;
      projectiles: Array<Record<string, unknown>>;
      magneticRivets: Array<Record<string, unknown>>;
      summons: Array<Record<string, unknown>>;
      flameFissures?: Array<Record<string, unknown>>;
      solarFireZones?: Array<Record<string, unknown>>;
      magmaTrails?: Array<Record<string, unknown>>;
      lightningPillars?: Array<Record<string, unknown>>;
      consumeEvents?: () => Array<Record<string, unknown>>;
    };

    const num = (v: unknown): number =>
      typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 1000) / 1000 : 0;

    const computeEntityPositions = (): Map<string, { x: number; y: number }> => {
      const m = new Map<string, { x: number; y: number }>();
      const p = sim.player;
      m.set('player', { x: Number(p.x ?? 0), y: Number(p.y ?? 0) });
      for (const e of sim.enemies ?? []) {
        if (Number(e.hp ?? 0) > 0) m.set(`enemy:${String(e.id)}`, { x: Number(e.x ?? 0), y: Number(e.y ?? 0) });
      }
      for (const pr of sim.props ?? []) {
        if (Number(pr.hp ?? 0) > 0) m.set(`prop:${String(pr.id)}`, { x: Number(pr.x ?? 0), y: Number(pr.y ?? 0) });
      }
      for (const b of sim.projectiles ?? []) {
        if (Number(b.ttlSec ?? 0) > 0) m.set(`proj:${String(b.id)}`, { x: Number(b.x ?? 0), y: Number(b.y ?? 0) });
      }
      return m;
    };

    const computeStateHash = (): string => {
      const p = sim.player;
      const pPart = [
        num(p.x), num(p.y), num(p.vx), num(p.vy), num(p.kbVx), num(p.kbVy),
        num(p.hp), num(p.armor), num(p.clipAmmo), num(p.reloadTimer), num(p.reloadDuration),
        num(p.weaponHeat), num(p.overheatLockTimer), num(p.meleeComboStep), num(p.fireCooldownTimer), num(p.dashTimer), num(p.aimAngle),
        num(p.solarOrbitAngle), num(p.salvageHoldTimer), num(p.gold),
      ].join(',');
      const ePart = (sim.enemies ?? [])
        .filter((e) => Number(e.hp ?? 0) > 0)
        .map((e) => [e.id, num(e.x), num(e.y), num(e.vx), num(e.vy), num(e.kbVx), num(e.kbVy), num(e.hp), String(e.aiState ?? ''), num(e.stuckArrows), num(e.parasiticThorns)].join(':'))
        .join(';');
      const prPart = (sim.props ?? [])
        .filter((pr) => Number(pr.hp ?? 0) > 0)
        .map((pr) => [pr.id, num(pr.x), num(pr.y), num(pr.vx), num(pr.vy), num(pr.hp), String(pr.coverState ?? ''), String(pr.pressState ?? ''), num(pr.pressTimer)].join(':'))
        .join(';');
      const bPart = (sim.projectiles ?? [])
        .filter((b) => Number(b.ttlSec ?? 0) > 0)
        .map((b) => [b.id, num(b.x), num(b.y), num(b.vx), num(b.vy), num(b.ttlSec)].join(':'))
        .join(';');
      const rPart = (sim.magneticRivets ?? []).map((r) => [r.id, num(r.x), num(r.y), num(r.ttlSec)].join(':')).join(';');
      const sPart = (sim.summons ?? [])
        .filter((s) => Number(s.hp ?? 0) > 0 && Number(s.ttlSec ?? 0) > 0)
        .map((s) => [s.id, num(s.x), num(s.y), num(s.hp), num(s.ttlSec)].join(':'))
        .join(';');
      const hPart = [
        (sim.flameFissures ?? []).map((f) => `${String(f.id)}:${num(f.ttlSec)}`).join(','),
        (sim.solarFireZones ?? []).map((z) => `${String(z.id)}:${num(z.ttlSec)}`).join(','),
        (sim.magmaTrails ?? []).map((m) => `${String(m.id)}:${num(m.ttlSec)}`).join(','),
        (sim.lightningPillars ?? []).map((l) => `${String(l.id)}:${num(l.ttlSec)}`).join(','),
      ].join('/');
      return `P[${pPart}]|E[${ePart}]|PR[${prPart}]|B[${bPart}]|R[${rPart}]|S[${sPart}]|H[${hPart}]`;
    };

    const collectKeyframeTrace: BrowserStripHarnessState['collectKeyframeTrace'] = (
      frameIndex, stage, customLabel, deltaTicks, rafStepsTaken, stateChangedInStep, includeProjectilesMode, enemyKinds, propKinds,
    ) => {
      const harness = win.__STRIP_HARNESS__!;
      const cam = (gs.cameras as { main?: { scrollX: number; scrollY: number; width: number; height: number; zoom: number } })?.main;
      const zoom = Math.max(0.1, cam?.zoom || 2);
      const camW = cam?.width || 1920;
      const camH = cam?.height || 1080;
      const topLeftWorldX = (cam?.scrollX ?? 0) + camW * 0.5 * (1 - 1 / zoom);
      const topLeftWorldY = (cam?.scrollY ?? 0) + camH * 0.5 * (1 - 1 / zoom);

      const worldRectToScreen = (wx: number, wy: number, ww: number, wh: number): ScreenRect => ({
        x: Math.round((wx - topLeftWorldX) * zoom),
        y: Math.round((wy - topLeftWorldY) * zoom),
        width: Math.max(2, Math.round(ww * zoom)),
        height: Math.max(2, Math.round(wh * zoom)),
      });

      const unionContainerVisibleBounds = (
        container: { list?: Array<Record<string, unknown>> } | undefined,
        anchorX: number,
        anchorY: number,
        radius: number,
      ) => {
        if (!container || !Array.isArray(container.list)) return null;
        let minX = Number.POSITIVE_INFINITY;
        let minY = Number.POSITIVE_INFINITY;
        let maxX = Number.NEGATIVE_INFINITY;
        let maxY = Number.NEGATIVE_INFINITY;
        for (const child of container.list) {
          if (!child.visible || Number(child.alpha ?? 1) <= 0.05) continue;
          const getBounds = child.getBounds as (() => { x: number; y: number; width: number; height: number }) | undefined;
          if (typeof getBounds === 'function') {
            const b = getBounds.call(child);
            if (b && b.width > 0 && b.height > 0 && Number.isFinite(b.x) && Number.isFinite(b.y)) {
              minX = Math.min(minX, b.x);
              minY = Math.min(minY, b.y);
              maxX = Math.max(maxX, b.x + b.width);
              maxY = Math.max(maxY, b.y + b.height);
            }
          }
        }
        if (!Number.isFinite(minX) || !Number.isFinite(minY)) return null;
        const halfW = Math.max(20, radius * 1.5);
        const topH = Math.max(30, radius * 2.1);
        const botH = Math.max(12, radius * 0.9);
        const cMinX = Math.max(minX, anchorX - halfW);
        const cMinY = Math.max(minY, anchorY - topH);
        const cMaxX = Math.min(maxX, anchorX + halfW);
        const cMaxY = Math.min(maxY, anchorY + botH);
        if (cMaxX <= cMinX || cMaxY <= cMinY) {
          return { x: anchorX - radius, y: anchorY - radius * 1.5, width: radius * 2, height: radius * 2.2 };
        }
        return { x: cMinX, y: cMinY, width: cMaxX - cMinX, height: cMaxY - cMinY };
      };

      const actors: TrackedActorBoundsRecord[] = [];
      const p = sim.player;
      const px = Number(p.x ?? 0);
      const py = Number(p.y ?? 0);
      const pr = Math.max(12, Number(p.radius ?? 12));
      const playerRig = gs.playerRig as { container?: { list?: Array<Record<string, unknown>> } } | undefined;
      const pRect = unionContainerVisibleBounds(playerRig?.container, px, py, pr) ?? { x: px - 16, y: py - 24, width: 32, height: 36 };
      actors.push({
        actorKey: 'player',
        kind: 'player',
        defIdOrKind: String(p.characterId ?? 'vanguard'),
        worldX: px,
        worldY: py,
        hp: Number(p.hp ?? 100),
        alive: Number(p.hp ?? 100) > 0,
        inChasm: sim.map?.getSurfaceAtWorld?.(px, py) === 'chasm',
        visible: true,
        screenBounds: worldRectToScreen(pRect.x, pRect.y, pRect.width, pRect.height),
      });

      const enemyRigs = gs.enemyRigs as Map<number, { container?: { list?: Array<Record<string, unknown>> } }> | undefined;
      let focusTargetX = px + Math.cos(Number(p.aimAngle ?? 0)) * 120;
      let focusTargetY = py + Math.sin(Number(p.aimAngle ?? 0)) * 120;
      let bestTargetDist = Number.POSITIVE_INFINITY;

      for (const e of sim.enemies ?? []) {
        const ehp = Number(e.hp ?? 0);
        if (ehp <= 0) continue;
        const eid = Number(e.id ?? 0);
        const defId = String(e.defId ?? '');
        const ex = Number(e.x ?? 0);
        const ey = Number(e.y ?? 0);
        const er = Math.max(12, Number(e.radius ?? 14));
        const d = Math.hypot(ex - px, ey - py);
        if ((!enemyKinds || enemyKinds.length === 0 || enemyKinds.includes(defId)) && d < bestTargetDist) {
          bestTargetDist = d;
          focusTargetX = ex;
          focusTargetY = ey;
        }
        const eRect = unionContainerVisibleBounds(enemyRigs?.get(eid)?.container, ex, ey, er) ?? { x: ex - er, y: ey - er * 1.5, width: er * 2, height: er * 2.2 };
        actors.push({
          actorKey: `enemy:${eid}`,
          kind: 'enemy',
          defIdOrKind: defId,
          worldX: ex,
          worldY: ey,
          hp: ehp,
          alive: true,
          inChasm: sim.map?.getSurfaceAtWorld?.(ex, ey) === 'chasm',
          visible: true,
          screenBounds: worldRectToScreen(eRect.x, eRect.y, eRect.width, eRect.height),
        });
      }

      const propVisuals = gs.propVisuals as Map<number, { sprite?: { visible?: boolean; alpha?: number; getBounds?: () => { x: number; y: number; width: number; height: number } } }> | undefined;
      for (const prObj of sim.props ?? []) {
        const prHp = Number(prObj.hp ?? 0);
        if (prHp <= 0) continue;
        const pKind = String(prObj.kind ?? '');
        const prx = Number(prObj.x ?? 0);
        const pry = Number(prObj.y ?? 0);
        const distToPlayer = Math.hypot(prx - px, pry - py);
        const cState = String(prObj.coverState ?? '');
        if (propKinds && propKinds.length > 0) {
          if (!propKinds.includes(pKind) || distToPlayer > 180) continue;
        } else {
          const isActiveCover =
            cState === 'sliding' || (pKind === 'moss_table' && distToPlayer <= 96);
          if (!isActiveCover) continue;
        }
        const pid = Number(prObj.id ?? 0);
        const prr = Math.max(14, Number(prObj.radius ?? 16));
        const pv = propVisuals?.get(pid);
        let prRect = { x: prx - prr, y: pry - prr, width: prr * 2, height: prr * 2 };
        if (pv?.sprite?.visible && Number(pv.sprite.alpha ?? 1) > 0.05 && pv.sprite.getBounds) {
          const b = pv.sprite.getBounds();
          if (b && b.width > 0 && b.height > 0) prRect = b;
        }
        actors.push({
          actorKey: `prop:${pid}`,
          kind: 'prop',
          defIdOrKind: pKind,
          worldX: prx,
          worldY: pry,
          hp: prHp,
          alive: true,
          inChasm: sim.map?.getSurfaceAtWorld?.(prx, pry) === 'chasm',
          visible: true,
          screenBounds: worldRectToScreen(prRect.x, prRect.y, prRect.width, prRect.height),
        });
      }

      if (includeProjectilesMode !== 'none') {
        const projSprites = gs.projectileSprites as Map<number, { sprite?: { visible?: boolean; alpha?: number; getBounds?: () => { x: number; y: number; width: number; height: number } } }> | undefined;
        const midX = (px + focusTargetX) * 0.5;
        const midY = (py + focusTargetY) * 0.5;
        for (const b of sim.projectiles ?? []) {
          if (Number(b.ttlSec ?? 0) <= 0) continue;
          const bx = Number(b.x ?? 0);
          const by = Number(b.y ?? 0);
          const br = Math.max(5, Number(b.radius ?? 5));
          const isEnemy = Boolean(b.isEnemy) || b.team === 'enemy';
          if (includeProjectilesMode === 'player_and_parried' && isEnemy && Math.hypot(bx - px, by - py) > 180) continue;
          if (includeProjectilesMode === 'all_focused' && Math.hypot(bx - midX, by - midY) > 180) continue;
          const bid = Number(b.id ?? 0);
          const ps = projSprites?.get(bid);
          let bRect = { x: bx - br, y: by - br, width: br * 2, height: br * 2 };
          if (ps?.sprite?.visible && Number(ps.sprite.alpha ?? 1) > 0.05 && ps.sprite.getBounds) {
            const sb = ps.sprite.getBounds();
            if (sb && sb.width > 0 && sb.height > 0) bRect = sb;
          }
          actors.push({
            actorKey: `proj:${bid}`,
            kind: 'projectile',
            defIdOrKind: String(b.weaponId ?? (isEnemy ? 'enemy_orb' : 'player_bolt')),
            worldX: bx,
            worldY: by,
            hp: 1,
            alive: true,
            inChasm: false,
            visible: true,
            screenBounds: worldRectToScreen(bRect.x, bRect.y, bRect.width, bRect.height),
          });
        }
      }

      for (const r of sim.magneticRivets ?? []) {
        const rx = Number(r.x ?? 0);
        const ry = Number(r.y ?? 0);
        actors.push({
          actorKey: `rivet:${String(r.id)}`,
          kind: 'rivet',
          defIdOrKind: 'magnetic_rivet',
          worldX: rx,
          worldY: ry,
          hp: 1,
          alive: true,
          inChasm: false,
          visible: true,
          screenBounds: worldRectToScreen(rx - 8, ry - 8, 16, 16),
        });
      }
      for (const s of sim.summons ?? []) {
        if (Number(s.hp ?? 0) <= 0 || Number(s.ttlSec ?? 0) <= 0) continue;
        const sx = Number(s.x ?? 0);
        const sy = Number(s.y ?? 0);
        actors.push({
          actorKey: `blossom:${String(s.id)}`,
          kind: 'blossom',
          defIdOrKind: String(s.kind ?? 'summon'),
          worldX: sx,
          worldY: sy,
          hp: Number(s.hp ?? 1),
          alive: true,
          inChasm: false,
          visible: true,
          screenBounds: worldRectToScreen(sx - 16, sy - 16, 32, 32),
        });
      }

      const alerts: FloatingAlertBoundsRecord[] = [];
      const fx = gs.fx as {
        hitStopRemainingMs?: number;
        trauma?: number;
        damagePool?: Array<{
          active: boolean;
          age: number;
          ttl: number;
          text: { visible: boolean; alpha: number; text: string; getBounds: () => { x: number; y: number; width: number; height: number } };
        }>;
      } | undefined;

      for (const d of fx?.damagePool ?? []) {
        if (!d.active || d.age >= d.ttl || !d.text.visible || d.text.alpha <= 0.05) continue;
        const rawText = (d.text.text ?? '').trim();
        if (!rawText) continue;
        const isNum = /^-?\d+!?$/.test(rawText);
        const tb = d.text.getBounds();
        if (tb && tb.width > 0 && tb.height > 0) {
          alerts.push({
            label: rawText,
            isNumericOnly: isNum,
            age: Number(d.age ?? 0),
            ttl: Number(d.ttl ?? 0.65),
            screenBounds: worldRectToScreen(tb.x, tb.y, tb.width, tb.height),
          });
        }
      }

      const reloadDuration = Number(p.reloadDuration ?? 0);
      const reloadTimer = Number(p.reloadTimer ?? 0);
      const reloadPct = reloadDuration > 0 && reloadTimer > 0 ? Math.round((1 - reloadTimer / reloadDuration) * 100) : 0;
      const playerStateSummary = `pos=(${Math.round(px)},${Math.round(py)}) ammo=${Number(p.clipAmmo ?? 0)} rld=${reloadPct}% heat=${Math.round(Number(p.weaponHeat ?? 0))}% combo=${Number(p.meleeComboStep ?? 0)}`;

      const enemySummaries = (sim.enemies ?? [])
        .filter((e) => Number(e.hp ?? 0) > 0)
        .slice(0, 2)
        .map((e) => `${String(e.defId ?? 'e').slice(0, 6)}@(${Math.round(Number(e.x ?? 0))},${Math.round(Number(e.y ?? 0))})`);
      const propSummaries = actors
        .filter((a) => a.kind === 'prop')
        .slice(0, 2)
        .map((a) => {
          const matchingProp = (sim.props ?? []).find((prObj) => `prop:${String(prObj.id)}` === a.actorKey);
          return `${String(matchingProp?.coverState ?? 'low')}@(${Math.round(a.worldX)},${Math.round(a.worldY)})`;
        });
      const targetDeltaPosSummary = [...enemySummaries, ...propSummaries].join(' ') || '-';

      return {
        frameIndex,
        frameLabel: `F${frameIndex + 1}`,
        stage,
        customLabel,
        simTick: sim.tick,
        deltaTicks,
        rafStepsTaken,
        hitStopActive: Number(fx?.hitStopRemainingMs ?? 0) > 0,
        maxInSimStepWorldPx: harness.lastStepMaxWorldDispPx,
        stateChangedInStep,
        changedScreenPixels: 0,
        roiRect: { x: 640, y: 360, width: 640, height: 360 },
        roiWorldCenter: { x: topLeftWorldX + 480, y: topLeftWorldY + 270 },
        playerStateSummary,
        targetDeltaPosSummary,
        actors,
        alerts,
        minFrameActorContainmentRatio: 1.0,
      };
    };

    if (!win.__STRIP_HARNESS__) {
      const state: BrowserStripHarnessState = {
        installed: true,
        captureActive: false,
        currentFrameIndex: 0,
        rafStepCounter: 0,
        postWarmupStartTick: sim.tick,
        lastPostStepStateHash: null,
        lastStepMaxWorldDispPx: 0,
        emittedSimEvents: [],
        externalStateMutations: [],
        inputQueue: [],
        computeStateHash,
        collectKeyframeTrace,
      };
      win.__STRIP_HARNESS__ = state;

      if (typeof sim.consumeEvents === 'function') {
        const origConsume = sim.consumeEvents.bind(sim);
        sim.consumeEvents = () => {
          const evs = origConsume();
          for (const ev of evs) {
            state.emittedSimEvents.push({
              simTick: sim.tick,
              rafStep: state.rafStepCounter,
              frameIndex: state.currentFrameIndex,
              simEventKind: String(ev.kind ?? ''),
              eventPayload: { ...ev },
              x: typeof ev.x === 'number' ? ev.x : undefined,
              y: typeof ev.y === 'number' ? ev.y : undefined,
            });
          }
          return evs;
        };
      }

      const fx = gs.fx as { spawnFloatingAlert?: (x: number, y: number, label: string, colorHex?: string) => void } | undefined;
      if (fx && typeof fx.spawnFloatingAlert === 'function') {
        const origSpawnAlert = fx.spawnFloatingAlert.bind(fx);
        fx.spawnFloatingAlert = (x: number, y: number, label: string, colorHex?: string) => {
          state.emittedSimEvents.push({
            simTick: sim.tick,
            rafStep: state.rafStepCounter,
            frameIndex: state.currentFrameIndex,
            alertLabel: String(label ?? ''),
            x: Number(x ?? 0),
            y: Number(y ?? 0),
          });
          return origSpawnAlert(x, y, label, colorHex);
        };
      }

      const origSendInput = transport.sendInput.bind(transport);
      transport.sendInput = (pkt: Record<string, unknown>) => {
        const activeCmd = state.inputQueue[0];
        if (activeCmd && activeCmd.remainingTicks > 0) {
          if (activeCmd.moveX !== undefined) pkt.moveX = activeCmd.moveX;
          if (activeCmd.moveY !== undefined) pkt.moveY = activeCmd.moveY;
          if (activeCmd.aimAngle !== undefined) {
            pkt.aimAngle = activeCmd.aimAngle;
          } else if (activeCmd.aimWorldX !== undefined && activeCmd.aimWorldY !== undefined) {
            pkt.aimAngle = Math.atan2(activeCmd.aimWorldY - Number(sim.player.y ?? 0), activeCmd.aimWorldX - Number(sim.player.x ?? 0));
          }
          let buttons = Number(pkt.buttons ?? 0);
          if (activeCmd.fire) buttons |= 1 << 0;
          if (activeCmd.dropWeapon) buttons |= 1 << 6;
          if (activeCmd.firstTickPending) {
            if (activeCmd.skill) buttons |= 1 << 1;
            if (activeCmd.dash) buttons |= 1 << 2;
            if (activeCmd.interact) buttons |= 1 << 3;
            if (activeCmd.swapWeapon) buttons |= 1 << 4;
            if (activeCmd.reloadVent) buttons |= 1 << 8;
            if (activeCmd.weaponSlotSelect !== undefined) pkt.weaponSlotSelect = activeCmd.weaponSlotSelect;
          }
          pkt.buttons = buttons;
        }
        return origSendInput(pkt);
      };

      const origStep = transport.step.bind(transport);
      transport.step = (dt: number) => {
        state.rafStepCounter += 1;
        if (state.captureActive && state.lastPostStepStateHash !== null) {
          const preHash = state.computeStateHash();
          if (preHash !== state.lastPostStepStateHash) {
            state.externalStateMutations.push({
              stepFromFrame: Math.max(0, state.currentFrameIndex - 1),
              simTick: sim.tick,
              entityKey: 'WorldSim',
              field: 'stateHash',
              afterPrevStepValue: state.lastPostStepStateHash.slice(0, 48),
              beforeNextStepValue: preHash.slice(0, 48),
            });
          }
        }
        const activeCmd = state.inputQueue[0];
        if (activeCmd && activeCmd.remainingTicks > 0 && activeCmd.aimWorldX !== undefined && activeCmd.aimWorldY !== undefined) {
          sim.player.aimWorldX = activeCmd.aimWorldX;
          sim.player.aimWorldY = activeCmd.aimWorldY;
        }
        const beforePos = computeEntityPositions();
        origStep(dt);
        const afterPos = computeEntityPositions();

        let maxDisp = 0;
        for (const [k, afterPt] of afterPos.entries()) {
          const beforePt = beforePos.get(k);
          if (beforePt) {
            const d = Math.hypot(afterPt.x - beforePt.x, afterPt.y - beforePt.y);
            if (d > maxDisp) maxDisp = d;
          }
        }
        state.lastStepMaxWorldDispPx = Math.max(state.lastStepMaxWorldDispPx, maxDisp);

        if (activeCmd && activeCmd.remainingTicks > 0) {
          activeCmd.firstTickPending = false;
          activeCmd.remainingTicks -= 1;
          if (activeCmd.remainingTicks <= 0) state.inputQueue.shift();
        }
        if (state.captureActive) {
          state.lastPostStepStateHash = state.computeStateHash();
        }
      };
    } else {
      win.__STRIP_HARNESS__.computeStateHash = computeStateHash;
      win.__STRIP_HARNESS__.collectKeyframeTrace = collectKeyframeTrace;
    }
  });
}

export async function markPostWarmupStartTick(page: Page): Promise<void> {
  await installSceneStripInstrumentation(page);
  await page.evaluate(() => {
    const win = window as unknown as {
      __STRIP_HARNESS__?: BrowserStripHarnessState;
      __GAME_TRANSPORT__?: { getSim: () => { tick: number } };
    };
    const sim = win.__GAME_TRANSPORT__?.getSim();
    if (win.__STRIP_HARNESS__ && sim) {
      win.__STRIP_HARNESS__.postWarmupStartTick = sim.tick;
      win.__STRIP_HARNESS__.currentFrameIndex = 0;
      win.__STRIP_HARNESS__.emittedSimEvents.length = 0;
      win.__STRIP_HARNESS__.externalStateMutations.length = 0;
      win.__STRIP_HARNESS__.inputQueue.length = 0;
    }
  });
}

export const markPostWarmupStart = markPostWarmupStartTick;

export async function queueStepInput(page: Page, spec: WhitelistInputSpec): Promise<void> {
  await installSceneStripInstrumentation(page);
  await page.evaluate((s) => {
    const win = window as unknown as {
      __STRIP_HARNESS__?: BrowserStripHarnessState;
      __PHASER_GAME__?: { scene: { getScene: (k: string) => Record<string, unknown> | undefined } };
    };
    if (!win.__STRIP_HARNESS__) return;
    win.__STRIP_HARNESS__.inputQueue.push({
      ...s,
      remainingTicks: Math.max(1, s.durationTicks ?? 1),
      firstTickPending: true,
    });
    if (s.aimWorldX !== undefined && s.aimWorldY !== undefined) {
      const gs = win.__PHASER_GAME__?.scene.getScene('GameScene');
      const cam = (gs?.cameras as { main?: { scrollX: number; scrollY: number; width: number; height: number; zoom: number } })?.main;
      const pointer = (gs?.input as { activePointer?: { x: number; y: number } })?.activePointer;
      if (cam && pointer) {
        const zoom = Math.max(0.1, cam.zoom || 2);
        const topLeftX = cam.scrollX + cam.width * 0.5 * (1 - 1 / zoom);
        const topLeftY = cam.scrollY + cam.height * 0.5 * (1 - 1 / zoom);
        pointer.x = (s.aimWorldX - topLeftX) * zoom;
        pointer.y = (s.aimWorldY - topLeftY) * zoom;
      }
    }
  }, spec);
}

export async function triggerReloadVent(page: Page): Promise<void> {
  await queueStepInput(page, { reloadVent: true, durationTicks: 1 });
}

export async function triggerInteract(page: Page): Promise<void> {
  await queueStepInput(page, { interact: true, durationTicks: 1 });
}

export async function triggerDash(
  page: Page,
  moveX = 1,
  moveY = 0,
  aimAngle?: number,
  durationTicks = 1,
): Promise<void> {
  await queueStepInput(page, {
    moveX,
    moveY,
    aimAngle: aimAngle ?? Math.atan2(moveY, moveX),
    dash: true,
    durationTicks,
  });
}

export async function triggerFireWeapon(
  page: Page,
  aimAngleOrOpts?:
    | number
    | { aimWorldX?: number; aimWorldY?: number; aimAngle?: number; holdTicks?: number },
  holdTicks = 1,
): Promise<void> {
  if (typeof aimAngleOrOpts === 'number') {
    await queueStepInput(page, {
      fire: true,
      aimAngle: aimAngleOrOpts,
      durationTicks: holdTicks,
    });
    return;
  }
  await queueStepInput(page, {
    fire: true,
    aimWorldX: aimAngleOrOpts?.aimWorldX,
    aimWorldY: aimAngleOrOpts?.aimWorldY,
    aimAngle: aimAngleOrOpts?.aimAngle,
    durationTicks: aimAngleOrOpts?.holdTicks ?? holdTicks,
  });
}
