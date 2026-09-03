import type { StationCount } from "./audio.js";

export type RxPreset = "clean" | "normal" | "noisy" | "contest";

export interface RxPresetLevels {
  bandNoiseLevel: number;
  qrnLevel: number;
  qrmLevel: number;
}

export interface RxEnvironmentSettings extends RxPresetLevels {
  enabled: boolean;
  preset: RxPreset;
  stationCount: StationCount;
}

export interface QrnEventPlan {
  delaySeconds: number;
  durationSeconds: number;
  intensity: number;
  pulses: 1 | 2 | 3;
  pulseSpacingSeconds: number;
  filterHz: number;
}

export interface QrmSignalPlan {
  text: string;
  delaySeconds: number;
  wpm: number;
  frequencyOffsetHz: number;
  gain: number;
  carrierDurationSeconds: number;
}

export interface QrmEventPlan {
  delaySeconds: number;
  signals: QrmSignalPlan[];
}

export const RX_PRESETS: Readonly<Record<RxPreset, RxPresetLevels>> = {
  clean: { bandNoiseLevel: 0.05, qrnLevel: 0, qrmLevel: 0 },
  normal: { bandNoiseLevel: 0.18, qrnLevel: 0.15, qrmLevel: 0 },
  noisy: { bandNoiseLevel: 0.3, qrnLevel: 0.35, qrmLevel: 0.15 },
  contest: { bandNoiseLevel: 0.25, qrnLevel: 0.25, qrmLevel: 0.45 },
};

export const DEFAULT_RX_ENVIRONMENT: RxEnvironmentSettings = {
  enabled: false,
  preset: "normal",
  stationCount: 1,
  ...RX_PRESETS.normal,
};

const QRM_FRAGMENTS = ["CQ TEST", "TEST", "DE", "QRZ", "AGN", "TU", "K", "5NN", "NR"] as const;
const clampUnit = (value: number): number => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
const randomBetween = (minimum: number, maximum: number, random: () => number): number => minimum + ((maximum - minimum) * random());

export function isRxPreset(value: unknown): value is RxPreset {
  return value === "clean" || value === "normal" || value === "noisy" || value === "contest";
}

export function restoreRxEnvironment(
  saved: Partial<RxEnvironmentSettings> | undefined,
  legacyEnabled?: boolean,
): RxEnvironmentSettings {
  const preset = isRxPreset(saved?.preset) ? saved.preset : DEFAULT_RX_ENVIRONMENT.preset;
  const presetLevels = RX_PRESETS[preset];
  return {
    enabled: saved?.enabled ?? legacyEnabled ?? DEFAULT_RX_ENVIRONMENT.enabled,
    preset,
    stationCount: Math.min(3, Math.max(1, Math.round(saved?.stationCount ?? 1))) as StationCount,
    bandNoiseLevel: clampUnit(saved?.bandNoiseLevel ?? presetLevels.bandNoiseLevel),
    qrnLevel: clampUnit(saved?.qrnLevel ?? presetLevels.qrnLevel),
    qrmLevel: clampUnit(saved?.qrmLevel ?? presetLevels.qrmLevel),
  };
}

export function createQrnEvent(level: number, random: () => number = Math.random): QrnEventPlan {
  const normalized = clampUnit(level);
  const minimumDelay = 1.4 + ((1 - normalized) * 5.5);
  const maximumDelay = 5 + ((1 - normalized) * 18);
  const pulseRoll = random();
  return {
    delaySeconds: randomBetween(minimumDelay, maximumDelay, random),
    durationSeconds: randomBetween(0.035, 0.16 + (normalized * 0.16), random),
    intensity: (0.12 + (normalized * 0.48)) * randomBetween(0.55, 1, random),
    pulses: pulseRoll > 0.78 ? 3 : pulseRoll > 0.48 ? 2 : 1,
    pulseSpacingSeconds: randomBetween(0.035, 0.12, random),
    filterHz: randomBetween(280, 2100, random),
  };
}

export function createQrmEvent(
  level: number,
  stationCount: StationCount,
  excludedTexts: readonly string[] = [],
  random: () => number = Math.random,
  candidateTexts: readonly string[] = QRM_FRAGMENTS,
): QrmEventPlan {
  const normalized = clampUnit(level);
  const excluded = new Set(excludedTexts.map((text) => text.trim().toUpperCase()));
  const available = candidateTexts.map((text) => text.trim().toUpperCase()).filter((text) => text && !excluded.has(text));
  const count = Math.min(stationCount, Math.max(1, Math.ceil(normalized * stationCount)));
  const signals = Array.from({ length: count }, (_, index): QrmSignalPlan => {
    const fragment = available[Math.floor(random() * available.length)] ?? "QRM";
    const offset = randomBetween(120, 800, random) * (random() < 0.5 ? -1 : 1);
    const carrier = random() < (0.12 + (normalized * 0.18));
    return {
      text: fragment,
      delaySeconds: index * randomBetween(0.05, 0.42, random),
      wpm: Math.round(randomBetween(14, 42, random)),
      frequencyOffsetHz: offset,
      gain: (0.08 + (normalized * 0.34)) * randomBetween(0.55, 0.95, random),
      carrierDurationSeconds: carrier ? randomBetween(0.18, 0.85, random) : 0,
    };
  });
  return {
    delaySeconds: randomBetween(2 + ((1 - normalized) * 8), 8 + ((1 - normalized) * 24), random),
    signals,
  };
}

/** Guarda o estado lógico para tornar start/stop idempotentes e testáveis. */
export class RxEnvironmentLifecycle {
  private running = false;

  get active(): boolean { return this.running; }

  start(enabled: boolean): boolean {
    if (!enabled || this.running) return false;
    this.running = true;
    return true;
  }

  stop(): boolean {
    if (!this.running) return false;
    this.running = false;
    return true;
  }
}
