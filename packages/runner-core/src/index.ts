export type RunnerMode = "practice" | "verified";

export interface RunnerSettings {
  wpm: number;
  toneHz: number;
  mode: RunnerMode;
}

export const DEFAULT_RUNNER_SETTINGS: RunnerSettings = {
  wpm: 28,
  toneHz: 650,
  mode: "practice",
};

export function clampWpm(value: number): number {
  return Math.min(60, Math.max(10, Math.round(value)));
}
