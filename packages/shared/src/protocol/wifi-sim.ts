import { SeededRandom } from '../core/prng.js';

export type WifiProfileId = 'off' | 'good' | 'normal' | 'bad';

export interface WifiProfileConfig {
  id: WifiProfileId;
  labelVi: string;
  oneWayLatencyMs: number;
  jitterMs: number;
  packetLossRate: number;
  spikeChancePerSec: number;
  spikeDurationMs: number;
}

export const WIFI_PROFILES: Record<WifiProfileId, WifiProfileConfig> = {
  off: {
    id: 'off',
    labelVi: 'LAN Trực Tiếp (0ms)',
    oneWayLatencyMs: 0,
    jitterMs: 0,
    packetLossRate: 0,
    spikeChancePerSec: 0,
    spikeDurationMs: 0,
  },
  good: {
    id: 'good',
    labelVi: 'Wi-Fi Tốt (5ms)',
    oneWayLatencyMs: 5,
    jitterMs: 2,
    packetLossRate: 0,
    spikeChancePerSec: 0,
    spikeDurationMs: 0,
  },
  normal: {
    id: 'normal',
    labelVi: 'Wi-Fi Thường (30ms ±10ms, 1% loss)',
    oneWayLatencyMs: 30,
    jitterMs: 10,
    packetLossRate: 0.01,
    spikeChancePerSec: 0.15,
    spikeDurationMs: 160,
  },
  bad: {
    id: 'bad',
    labelVi: 'Wi-Fi Tệ (80ms ±20ms, 2% loss + Spike 300ms)',
    oneWayLatencyMs: 80,
    jitterMs: 20,
    packetLossRate: 0.02,
    spikeChancePerSec: 0.35,
    spikeDurationMs: 300,
  },
};

interface QueuedPacket<T> {
  deliverAtMs: number;
  payload: T;
  onDeliver: (payload: T) => void;
}

/**
 * Deterministic & zero-timer Wi-Fi condition simulator for testing LAN netcode
 * under latency (5/30/80ms), jitter (±20ms), packet loss (1-2%), and random 300ms lag spikes.
 */
export class WifiSimulator {
  private profile: WifiProfileConfig = WIFI_PROFILES.off;
  private readonly rng: SeededRandom;
  private virtualClockMs = 0;
  private activeSpikeUntilMs = 0;
  private readonly queue: QueuedPacket<unknown>[] = [];

  public totalPacketsSent = 0;
  public totalPacketsDropped = 0;
  public totalSpikesTriggered = 0;
  public lastSimulatedRttMs = 0;

  constructor(
    seedOrProfile: string | number | WifiProfileId = 0x99887766,
    initialProfileOrSeed: WifiProfileId | number = 'off',
  ) {
    if (
      typeof seedOrProfile === 'string' &&
      (seedOrProfile === 'off' ||
        seedOrProfile === 'good' ||
        seedOrProfile === 'normal' ||
        seedOrProfile === 'bad')
    ) {
      const seedVal = typeof initialProfileOrSeed === 'number' ? initialProfileOrSeed : 0x99887766;
      this.rng = new SeededRandom(seedVal);
      this.profile = WIFI_PROFILES[seedOrProfile] ?? WIFI_PROFILES.off;
    } else {
      this.rng = new SeededRandom(seedOrProfile);
      const profId =
        typeof initialProfileOrSeed === 'string' ? initialProfileOrSeed : ('off' as WifiProfileId);
      this.profile = WIFI_PROFILES[profId] ?? WIFI_PROFILES.off;
    }
  }

  public setProfile(profileId: WifiProfileId): void {
    this.profile = WIFI_PROFILES[profileId] ?? WIFI_PROFILES.off;
    if (profileId === 'off') {
      this.activeSpikeUntilMs = 0;
      this.flushAllImmediately();
    }
  }

  public getProfile(): WifiProfileId {
    return this.profile.id;
  }

  public getProfileConfig(): WifiProfileConfig {
    return this.profile;
  }

  public getProfileId(): WifiProfileId {
    return this.profile.id;
  }

  public getNowMs(): number {
    return this.virtualClockMs;
  }

  public getStats(): {
    packetsSent: number;
    packetsDropped: number;
    spikesTriggered: number;
    currentLatencyMs: number;
  } {
    return {
      packetsSent: this.totalPacketsSent,
      packetsDropped: this.totalPacketsDropped,
      spikesTriggered: this.totalSpikesTriggered,
      currentLatencyMs: this.profile.oneWayLatencyMs,
    };
  }

  public triggerManualLagSpike(durationMs = 300): void {
    this.activeSpikeUntilMs = Math.max(this.activeSpikeUntilMs, this.virtualClockMs + durationMs);
    this.totalSpikesTriggered += 1;
  }

  /**
   * Schedules a packet through the simulated Wi-Fi channel.
   * Critical reliable control packets (`droppable = false`) are delayed by latency/spike but never dropped.
   */
  public send<T>(payload: T, onDeliver: (payload: T) => void, droppable = true): void {
    this.totalPacketsSent += 1;

    if (this.profile.id === 'off') {
      this.lastSimulatedRttMs = 1;
      onDeliver(payload);
      return;
    }

    if (
      droppable &&
      this.profile.packetLossRate > 0 &&
      this.rng.chance(this.profile.packetLossRate)
    ) {
      this.totalPacketsDropped += 1;
      return;
    }

    const jitter =
      this.profile.jitterMs > 0
        ? this.rng.nextFloat(-this.profile.jitterMs, this.profile.jitterMs)
        : 0;
    const spikeExtra =
      this.virtualClockMs < this.activeSpikeUntilMs
        ? Math.max(0, this.activeSpikeUntilMs - this.virtualClockMs)
        : 0;
    const delayMs = Math.max(1, this.profile.oneWayLatencyMs + jitter + spikeExtra * 0.5);
    this.lastSimulatedRttMs = Math.round(delayMs * 2);

    this.queue.push({
      deliverAtMs: this.virtualClockMs + delayMs,
      payload,
      onDeliver: onDeliver as (p: unknown) => void,
    });
  }

  public sendOutbound<T>(payload: T, onDeliver: (payload: T) => void, droppable = true): void {
    this.send(payload, onDeliver, droppable);
  }

  public receiveInbound<T>(payload: T, onDeliver: (payload: T) => void, droppable = true): void {
    this.send(payload, onDeliver, droppable);
  }

  /**
   * Advances the virtual Wi-Fi clock and delivers all packets whose arrival time has been reached.
   */
  public step(deltaMs: number): void {
    this.virtualClockMs += Math.max(0, deltaMs);

    if (
      this.profile.spikeChancePerSec > 0 &&
      this.virtualClockMs >= this.activeSpikeUntilMs &&
      this.rng.chance(this.profile.spikeChancePerSec * (deltaMs / 1000))
    ) {
      this.activeSpikeUntilMs = this.virtualClockMs + this.profile.spikeDurationMs;
      this.totalSpikesTriggered += 1;
    }

    if (this.queue.length === 0) return;

    // Sort by deliverAtMs so out-of-order jitter or spike bursts resolve cleanly
    this.queue.sort((a, b) => a.deliverAtMs - b.deliverAtMs);

    while (this.queue.length > 0 && this.queue[0]!.deliverAtMs <= this.virtualClockMs) {
      const pkt = this.queue.shift()!;
      pkt.onDeliver(pkt.payload);
    }
  }

  public flushAllImmediately(): void {
    while (this.queue.length > 0) {
      const pkt = this.queue.shift()!;
      pkt.onDeliver(pkt.payload);
    }
  }
}
