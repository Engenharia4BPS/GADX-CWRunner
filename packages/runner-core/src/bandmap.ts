export type OperatingMode = "RUN" | "S_AND_P";
export type BandmapStationStatus = "available" | "selected" | "worked";

export interface BandmapStation {
  id: string;
  callsign: string;
  frequencyKhz: number;
  wpm: number;
  toneHz: number;
  signalDb: number;
  spottedAt: number;
  status: BandmapStationStatus;
}

export interface BandmapOptions {
  lowerKhz?: number;
  upperKhz?: number;
  stationCount?: number;
  minimumSpacingKhz?: number;
  baseWpm: number;
  baseToneHz: number;
  spottedAt: number;
}

export const BANDMAP_40M = {
  lowerKhz: 7000,
  upperKhz: 7040,
  initialKhz: 7025,
  stationCount: 15,
  minimumSpacingKhz: 0.35,
} as const;

const clamp = (value: number, minimum: number, maximum: number): number => Math.min(maximum, Math.max(minimum, value));
const clampBandmapWpm = (value: number): number => Math.min(60, Math.max(10, Math.round(value)));

/** Mulberry32: PRNG pequeno para cenários e testes reproduzíveis. */
export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export class VirtualVfo {
  private frequency: number;
  readonly lowerKhz: number;
  readonly upperKhz: number;

  constructor(
    initialKhz = BANDMAP_40M.initialKhz,
    lowerKhz = BANDMAP_40M.lowerKhz,
    upperKhz = BANDMAP_40M.upperKhz,
  ) {
    this.lowerKhz = lowerKhz;
    this.upperKhz = upperKhz;
    this.frequency = clamp(initialKhz, lowerKhz, upperKhz);
  }

  get frequencyKhz(): number { return this.frequency; }

  tune(frequencyKhz: number): number {
    this.frequency = clamp(frequencyKhz, this.lowerKhz, this.upperKhz);
    return this.frequency;
  }
}

export class BandmapEngine {
  private stationList: BandmapStation[] = [];
  private readonly random: () => number;

  constructor(random: () => number = Math.random) {
    this.random = random;
  }

  get stations(): readonly BandmapStation[] { return this.stationList.map((station) => ({ ...station })); }
  get selectedStation(): BandmapStation | undefined {
    const station = this.stationList.find(({ status }) => status === "selected");
    return station ? { ...station } : undefined;
  }

  generate(callsigns: readonly string[], options: BandmapOptions): readonly BandmapStation[] {
    const lowerKhz = options.lowerKhz ?? BANDMAP_40M.lowerKhz;
    const upperKhz = options.upperKhz ?? BANDMAP_40M.upperKhz;
    const count = options.stationCount ?? BANDMAP_40M.stationCount;
    const spacing = options.minimumSpacingKhz ?? BANDMAP_40M.minimumSpacingKhz;
    const unique = [...new Set(callsigns.map((callsign) => callsign.trim().toUpperCase()).filter(Boolean))];
    if (unique.length < count) throw new Error(`São necessários ${count} indicativos únicos para gerar o Bandmap.`);
    const margin = Math.max(spacing, 0.4);
    const usable = upperKhz - lowerKhz - (margin * 2);
    const slotSize = usable / count;
    if (slotSize * 0.3 < spacing) throw new Error("A faixa não comporta as estações com o espaçamento solicitado.");

    this.stationList = unique.slice(0, count).map((callsign, index): BandmapStation => {
      const slotPosition = index + 0.15 + (this.random() * 0.7);
      const frequencyKhz = Math.round((lowerKhz + margin + (slotPosition * slotSize)) * 100) / 100;
      return {
        id: `spot-${index + 1}-${callsign}`,
        callsign,
        frequencyKhz,
        wpm: clampBandmapWpm(options.baseWpm + Math.round((this.random() * 6) - 3)),
        toneHz: Math.round(clamp(options.baseToneHz + ((this.random() * 60) - 30), 300, 1000)),
        signalDb: Math.round(-18 + (this.random() * 15)),
        spottedAt: options.spottedAt - Math.round(this.random() * 15 * 60_000),
        status: "available",
      };
    }).sort((left, right) => left.frequencyKhz - right.frequencyKhz);
    return this.stations;
  }

  select(id: string): BandmapStation | undefined {
    const target = this.stationList.find((station) => station.id === id && station.status !== "worked");
    if (!target) return undefined;
    for (const station of this.stationList) {
      if (station.status === "selected") station.status = "available";
    }
    target.status = "selected";
    return { ...target };
  }

  clearSelection(): void {
    for (const station of this.stationList) {
      if (station.status === "selected") station.status = "available";
    }
  }

  clear(): void {
    this.stationList = [];
  }

  markWorked(id: string): void {
    const station = this.stationList.find((candidate) => candidate.id === id);
    if (station) station.status = "worked";
  }

  adjacent(direction: 1 | -1): BandmapStation | undefined {
    const available = this.stationList.filter(({ status }) => status !== "worked");
    const candidates = available.length ? available : this.stationList;
    if (!candidates.length) return undefined;
    const selectedId = this.selectedStation?.id;
    const currentIndex = candidates.findIndex(({ id }) => id === selectedId);
    const nextIndex = currentIndex < 0
      ? (direction === 1 ? 0 : candidates.length - 1)
      : (currentIndex + direction + candidates.length) % candidates.length;
    return { ...candidates[nextIndex]! };
  }
}
