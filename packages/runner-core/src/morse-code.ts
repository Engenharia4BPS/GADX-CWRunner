export type MorseElement =
  | { type: "tone"; dits: 1 | 3 }
  | { type: "silence"; dits: 1 | 3 | 7 };

/** Tabela internacional de caracteres CW, conforme ITU-R M.1677. */
export const MORSE_CODE: Readonly<Record<string, string>> = {
  A: ".-", B: "-...", C: "-.-.", D: "-..", E: ".", F: "..-.",
  G: "--.", H: "....", I: "..", J: ".---", K: "-.-", L: ".-..",
  M: "--", N: "-.", O: "---", P: ".--.", Q: "--.-", R: ".-.",
  S: "...", T: "-", U: "..-", V: "...-", W: ".--", X: "-..-",
  Y: "-.--", Z: "--..", 0: "-----", 1: ".----", 2: "..---",
  3: "...--", 4: "....-", 5: ".....", 6: "-....", 7: "--...",
  8: "---..", 9: "----.", ".": ".-.-.-", ",": "--..--", "?": "..--..",
  "'": ".----.", "!": "-.-.--", "/": "-..-.", "(": "-.--.", ")": "-.--.-",
  "&": ".-...", ":": "---...", ";": "-.-.-.", "=": "-...-", "+": ".-.-.",
  "-": "-....-", "_": "..--.-", "\"": ".-..-.", "$": "...-..-", "@": ".--.-.",
};

/** Converte texto suportado em tons e silêncios, sem dependência do navegador. */
export function encodeMorse(text: string): MorseElement[] {
  const characters = [...text.toUpperCase()].filter((character) => character === " " || MORSE_CODE[character]);
  const elements: MorseElement[] = [];

  characters.forEach((character, characterIndex) => {
    if (character === " ") {
      if (elements.length > 0 && elements.at(-1)?.type !== "silence") elements.push({ type: "silence", dits: 7 });
      return;
    }
    const pattern = MORSE_CODE[character]!;
    [...pattern].forEach((mark, markIndex) => {
      elements.push({ type: "tone", dits: mark === "." ? 1 : 3 });
      if (markIndex < pattern.length - 1) elements.push({ type: "silence", dits: 1 });
    });
    const next = characters[characterIndex + 1];
    if (next && next !== " ") elements.push({ type: "silence", dits: 3 });
  });
  return elements;
}
