import { FixedTimestepLoop } from '../core/fixed-timestep.js';
import { lerp } from '../math/vec2.js';
import { INPUT_BUTTON, type PlayerInputPacket } from './messages.js';
import {
  type SimEnemyState,
  type SimEvent,
  type SimPickupState,
  type SimPlayerState,
  type SimProjectileState,
  WorldSim,
  type WorldSimOptions,
} from '../sim/world-sim.js';

export interface InterpolatedEntityPos {
  x: number;
  y: number;
}

export interface ITransport {
  readonly mode: 'local' | 'network';
  sendInput(input: PlayerInputPacket): void;
  step(deltaMs: number): { ticksExecuted: number; alpha: number; tick: number };
  getSim(): WorldSim;
  getInterpolationAlpha(): number;
  getInterpolatedPlayerPos(out?: InterpolatedEntityPos): InterpolatedEntityPos;
  getInterpolatedSimPlayerPos(
    player: SimPlayerState,
    out?: InterpolatedEntityPos,
  ): InterpolatedEntityPos;
  getInterpolatedEnemyPos(enemy: SimEnemyState, out?: InterpolatedEntityPos): InterpolatedEntityPos;
  getInterpolatedProjectilePos(
    proj: SimProjectileState,
    out?: InterpolatedEntityPos,
  ): InterpolatedEntityPos;
  getInterpolatedPickupPos(
    pickup: SimPickupState,
    out?: InterpolatedEntityPos,
  ): InterpolatedEntityPos;
  consumeEvents(): SimEvent[];
}

/**
 * LocalTransport runs the authoritative 60Hz WorldSim directly in the client browser for Solo mode.
 * Shares the exact same WorldSim & ITransport interface that NetworkTransport uses in Phase 4.
 */
export class LocalTransport implements ITransport {
  public readonly mode = 'local' as const;
  private readonly sim: WorldSim;
  private readonly loop: FixedTimestepLoop;
  private alpha = 1;
  private latestInput: PlayerInputPacket = {
    seq: 0,
    tick: 0,
    moveX: 0,
    moveY: 0,
    aimAngle: 0,
    buttons: 0,
    weaponSlotSelect: null,
  };

  constructor(options: WorldSimOptions = {}) {
    this.sim = new WorldSim(options);
    this.loop = new FixedTimestepLoop(60);
    // Pre-prime accumulator to ~99.9% of one tick so the first frame's input triggers an immediate tick
    // and 60Hz frames render at alpha ~ 1.0 (zero 1-frame interpolation lag).
    this.loop.primeForImmediateTick();
    this.alpha = this.loop.getAlpha();
  }

  public sendInput(input: PlayerInputPacket): void {
    this.latestInput.seq = input.seq;
    this.latestInput.tick = input.tick;
    this.latestInput.moveX = input.moveX;
    this.latestInput.moveY = input.moveY;
    this.latestInput.aimAngle = input.aimAngle;
    this.latestInput.buttons = input.buttons;
    this.latestInput.weaponSlotSelect = input.weaponSlotSelect;
    this.sim.setPlayerInput(input);
  }

  public step(deltaMs: number): { ticksExecuted: number; alpha: number; tick: number } {
    const p = this.sim.player;
    const isAtRest =
      p.vx === 0 && p.vy === 0 && p.prevX === p.x && p.prevY === p.y && p.dashTimer <= 0;
    const hasImmediateIntent =
      this.latestInput.moveX !== 0 ||
      this.latestInput.moveY !== 0 ||
      (this.latestInput.buttons &
        (INPUT_BUTTON.DASH | INPUT_BUTTON.FIRE | INPUT_BUTTON.SKILL | INPUT_BUTTON.INTERACT)) !==
        0;

    if (isAtRest && hasImmediateIntent) {
      this.loop.primeForImmediateTick(deltaMs);
    }

    const res = this.loop.step(deltaMs, (dtSec) => {
      this.sim.step(dtSec);
    });
    this.alpha = res.alpha;
    return res;
  }

  public getSim(): WorldSim {
    return this.sim;
  }

  public getPlayer(): SimPlayerState {
    return this.sim.player;
  }

  public getInterpolationAlpha(): number {
    return this.alpha;
  }

  public getInterpolatedPlayerPos(out?: InterpolatedEntityPos): InterpolatedEntityPos {
    const p = this.sim.player;
    const x = lerp(p.prevX, p.x, this.alpha);
    const y = lerp(p.prevY, p.y, this.alpha);
    if (out) {
      out.x = x;
      out.y = y;
      return out;
    }
    return { x, y };
  }

  public getInterpolatedSimPlayerPos(
    player: SimPlayerState,
    out?: InterpolatedEntityPos,
  ): InterpolatedEntityPos {
    const x = lerp(player.prevX, player.x, this.alpha);
    const y = lerp(player.prevY, player.y, this.alpha);
    if (out) {
      out.x = x;
      out.y = y;
      return out;
    }
    return { x, y };
  }

  public getInterpolatedEnemyPos(
    enemy: SimEnemyState,
    out?: InterpolatedEntityPos,
  ): InterpolatedEntityPos {
    const x = lerp(enemy.prevX, enemy.x, this.alpha);
    const y = lerp(enemy.prevY, enemy.y, this.alpha);
    if (out) {
      out.x = x;
      out.y = y;
      return out;
    }
    return { x, y };
  }

  public getInterpolatedProjectilePos(
    proj: SimProjectileState,
    out?: InterpolatedEntityPos,
  ): InterpolatedEntityPos {
    const x = lerp(proj.prevX, proj.x, this.alpha);
    const y = lerp(proj.prevY, proj.y, this.alpha);
    if (out) {
      out.x = x;
      out.y = y;
      return out;
    }
    return { x, y };
  }

  public getInterpolatedPickupPos(
    pickup: SimPickupState,
    out?: InterpolatedEntityPos,
  ): InterpolatedEntityPos {
    const x = lerp(pickup.prevX, pickup.x, this.alpha);
    const y = lerp(pickup.prevY, pickup.y, this.alpha);
    if (out) {
      out.x = x;
      out.y = y;
      return out;
    }
    return { x, y };
  }

  public consumeEvents(): SimEvent[] {
    return this.sim.consumeEvents();
  }
}
