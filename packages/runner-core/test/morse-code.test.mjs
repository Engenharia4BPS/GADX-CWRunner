import assert from "node:assert/strict";
import test from "node:test";
import { MORSE_CODE, encodeMorse } from "../src/morse-code.ts";

test("tabela Morse inclui letras, números e pontuação internacional", () => {
  assert.equal("ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").every((symbol) => MORSE_CODE[symbol]), true);
  assert.equal("0123456789".split("").every((symbol) => MORSE_CODE[symbol]), true);
  assert.deepEqual(Object.fromEntries([".", ",", "?", "!", "/", "=", "+", "-", "@"].map((symbol) => [symbol, MORSE_CODE[symbol]])), {
    ".": ".-.-.-", ",": "--..--", "?": "..--..", "!": "-.-.--", "/": "-..-.", "=": "-...-", "+": ".-.-.", "-": "-....-", "@": ".--.-.",
  });
});

test("codificador mantém os sinais especiais da tabela", () => {
  assert.equal(encodeMorse("A?@!").filter((element) => element.type === "tone").length > 0, true);
});
