export type RunnerMode = "practice" | "verified";

export * from "./audio.js";
export * from "./band-activity.js";
export * from "./bandmap.js";
export * from "./callsigns.js";
export * from "./callsign-copy.js";
export * from "./cut-numbers.js";
export * from "./cw-contest-parser.js";
export * from "./dx-operator.js";
export * from "./morse-code.js";
export * from "./rx-environment.js";
export * from "./sandp-session.js";
export * from "./sandp-world.js";
export * from "./sp-qso.js";

/** Estados do fluxo local de um QSO de contest. */
export const QSO_TRAINING_STATES = {
  STOPPED: "PARADO",
  CALLING_CQ: "CHAMANDO CQ",
  RECEIVING_CALLSIGN: "RECEBENDO INDICATIVO",
  SENDING_CALLSIGN: "ENVIANDO INDICATIVO",
  RECEIVING_EXCHANGE: "RECEBENDO INTERCÂMBIO",
  COMPLETED: "QSO CONCLUÍDO",
} as const;

export type QsoTrainingState = (typeof QSO_TRAINING_STATES)[keyof typeof QSO_TRAINING_STATES];

export interface RunnerSettings {
  wpm: number;
  toneHz: number;
  mode: RunnerMode;
}

export const DEFAULT_RUNNER_SETTINGS: RunnerSettings = {
  wpm: 28,
  toneHz: 600,
  mode: "practice",
};

export function clampWpm(value: number): number {
  return Math.min(60, Math.max(10, Math.round(value)));
}

/** Duração padrão de um dit, em segundos: 1,2 / WPM. */
export function ditDurationSeconds(wpm: number): number {
  return 1.2 / clampWpm(wpm);
}

const PREFIXES = ["PY", "PP", "PR", "PU", "ZY", "LU", "CX", "CE", "OA", "YV"] as const;
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** Gera um indicativo de formato usual para treino; injete random para sequências reproduzíveis. */
export function generatePlausibleCallsign(random: () => number = Math.random): string {
  const pick = <T,>(items: readonly T[]): T => items[Math.floor(random() * items.length)]!;
  const suffixLength = random() < 0.35 ? 2 : 3;
  const suffix = Array.from({ length: suffixLength }, () => LETTERS[Math.floor(random() * LETTERS.length)]!).join("");
  const base = `${pick(PREFIXES)}${Math.floor(random() * 10)}${suffix}`;
  return random() < 0.08 ? `${base}/P` : base;
}
