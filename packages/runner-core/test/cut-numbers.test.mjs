import assert from "node:assert/strict";
import test from "node:test";
import { abbreviateCwNumbers } from "../src/cut-numbers.ts";

test("abrevia números de concurso sem alterar texto não numérico", () => {
  assert.equal(abbreviateCwNumbers("599 001"), "5NN TTA");
  assert.equal(abbreviateCwNumbers("RST 579"), "RST 57N");
});

test("abreviações CUT usam letras Morse curtas", () => {
  assert.equal(abbreviateCwNumbers("19"), "AN");
  assert.equal(abbreviateCwNumbers("09"), "TN");
});
