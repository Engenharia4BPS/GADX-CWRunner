export type RunnerMode = "practice" | "verified";

export * from "./audio.js";
export * from "./bandmap.js";
export * from "./callsigns.js";
export * from "./callsign-copy.js";
export * from "./cw-contest-parser.js";
export * from "./rx-environment.js";
export * from "./sandp-session.js";
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

export type MorseElement =
  | { type: "tone"; dits: 1 | 3 }
  | { type: "silence"; dits: 1 | 3 | 7 };

const MORSE: Readonly<Record<string, string>> = {
  A: ".-", B: "-...", C: "-.-.", D: "-..", E: ".", F: "..-.",
  G: "--.", H: "....", I: "..", J: ".---", K: "-.-", L: ".-..",
  M: "--", N: "-.", O: "---", P: ".--.", Q: "--.-", R: ".-.",
  S: "...", T: "-", U: "..-", V: "...-", W: ".--", X: "-..-",
  Y: "-.--", Z: "--..", 0: "-----", 1: ".----", 2: "..---",
  3: "...--", 4: "....-", 5: ".....", 6: "-....", 7: "--...",
  8: "---..", 9: "----.", "/": "-..-.",
};

/** Converte texto suportado em tons e silêncios, sem dependência do navegador. */
export function encodeMorse(text: string): MorseElement[] {
  const characters = [...text.toUpperCase()].filter((character) => character === " " || MORSE[character]);
  const elements: MorseElement[] = [];

  characters.forEach((character, characterIndex) => {
    if (character === " ") {
      if (elements.length > 0 && elements.at(-1)?.type !== "silence") elements.push({ type: "silence", dits: 7 });
      return;
    }
    const pattern = MORSE[character];
    [...pattern].forEach((mark, markIndex) => {
      elements.push({ type: "tone", dits: mark === "." ? 1 : 3 });
      if (markIndex < pattern.length - 1) elements.push({ type: "silence", dits: 1 });
    });
    const next = characters[characterIndex + 1];
    if (next && next !== " ") elements.push({ type: "silence", dits: 3 });
  });
  return elements;
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
