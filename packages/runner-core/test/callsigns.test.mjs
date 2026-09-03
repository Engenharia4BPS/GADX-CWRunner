import assert from "node:assert/strict";
import test from "node:test";
import { CallsignSelector, normalizeCallsignList } from "../src/callsigns.ts";

test("normaliza e remove entradas inválidas ou duplicadas", () => {
  assert.deepEqual(normalizeCallsignList([" py5xt ", "PY5XT", "K1ABC", "inválido!", 123]), ["PY5XT", "K1ABC"]);
});

test("não repete nenhum dos últimos 20 indicativos", () => {
  const callsigns = Array.from({ length: 30 }, (_, index) => `PY${index % 10}A${String(index).padStart(2, "0")}`);
  const selector = new CallsignSelector(callsigns, () => "PP5ZZZ", () => 0);
  const history = [];
  for (let index = 0; index < 60; index += 1) {
    const selected = selector.next();
    assert.equal(history.slice(-20).includes(selected), false);
    history.push(selected);
  }
});

test("respeita exclusões e usa o gerador artificial como fallback", () => {
  const selector = new CallsignSelector(["PY5XT"], () => "LU1ABC", () => 0);
  assert.equal(selector.next(["PY5XT"]), "LU1ABC");
});
