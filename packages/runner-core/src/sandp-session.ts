import type { BandmapEngine, BandmapStation, VirtualVfo } from "./bandmap.js";

export interface SandPSessionPorts {
  stopCw(): void;
  playCq(station: BandmapStation): number;
  schedule(action: () => void, delayMs: number): unknown;
  cancelSchedule(handle: unknown): void;
  onSelection(station: BandmapStation): void;
}

export class SandPSessionController {
  private active = false;
  private cqTimer: unknown;
  private readonly bandmap: BandmapEngine;
  private readonly vfo: VirtualVfo;
  private readonly ports: SandPSessionPorts;
  private readonly random: () => number;

  constructor(
    bandmap: BandmapEngine,
    vfo: VirtualVfo,
    ports: SandPSessionPorts,
    random: () => number = Math.random,
  ) {
    this.bandmap = bandmap;
    this.vfo = vfo;
    this.ports = ports;
    this.random = random;
  }

  get running(): boolean { return this.active; }
  get currentStation(): BandmapStation | undefined { return this.bandmap.selectedStation; }

  start(): void {
    this.stop(false);
    this.active = true;
  }

  tune(stationId: string): BandmapStation | undefined {
    if (!this.active) return undefined;
    this.cancelCurrentCq();
    const station = this.bandmap.select(stationId);
    if (!station) return undefined;
    this.vfo.tune(station.frequencyKhz);
    this.ports.onSelection(station);
    this.playAndSchedule(station);
    return station;
  }

  navigate(direction: 1 | -1): BandmapStation | undefined {
    const station = this.bandmap.adjacent(direction);
    return station ? this.tune(station.id) : undefined;
  }

  repeat(): boolean {
    const station = this.currentStation;
    if (!this.active || !station) return false;
    this.cancelCurrentCq();
    this.playAndSchedule(station);
    return true;
  }

  stop(clearSelection = true): void {
    this.active = false;
    this.cancelCurrentCq();
    if (clearSelection) this.bandmap.clearSelection();
  }

  private playAndSchedule(station: BandmapStation): void {
    const duration = this.ports.playCq(station);
    const pause = 1500 + Math.round(this.random() * 2500);
    this.cqTimer = this.ports.schedule(() => {
      this.cqTimer = undefined;
      if (this.active && this.currentStation?.id === station.id) this.playAndSchedule(station);
    }, duration + pause);
  }

  private cancelCurrentCq(): void {
    if (this.cqTimer !== undefined) this.ports.cancelSchedule(this.cqTimer);
    this.cqTimer = undefined;
    this.ports.stopCw();
  }
}
