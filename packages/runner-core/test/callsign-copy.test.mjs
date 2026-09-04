import assert from "node:assert/strict";
import test from "node:test";
import { analyzeCallCopy } from "../src/callsign-copy.ts";

test("copia de PY5XT reconhece correcao, trecho desconhecido e lid", () => {
  for (const copied of ["PY5XT", " py5xt "]) assert.equal(analyzeCallCopy("PY5XT", copied).kind, "exact");
  for (const copied of ["PY5?T", "PY?T", "PY5X", "PY5XTT", "PY5XT?"]) assert.equal(analyzeCallCopy("PY5XT", copied).kind, "almost");
  for (const copied of ["PP5ABC", "", "???"]) assert.equal(analyzeCallCopy("PY5XT", copied).kind, "wrong");
});

test("copia ponderada aceita formatos distintos sem aceitar call sem relacao", () => {
  assert.equal(analyzeCallCopy("K1ABC/P", "K1AC/P").kind, "almost");
  assert.equal(analyzeCallCopy("DL7AA", "DL?AA").kind, "almost");
  assert.equal(analyzeCallCopy("DL7AA", "JA3YBK").kind, "wrong");
});
