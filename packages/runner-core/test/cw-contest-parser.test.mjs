import assert from "node:assert/strict";
import test from "node:test";
import { parseContestTransmission } from "../src/cw-contest-parser.ts";

const context = { operatorCall: "PY5XT", stationCall: "K1ABC", operatorSerial: "001", stationExchange: "123" };

test("interpreta chamadas e exchanges de contest", () => {
  assert.deepEqual(parseContestTransmission("K1ABC PY5XT", context), { kind: "call-station", copiedCall: "PY5XT" });
  for (const text of ["K1ABC 5NN 001", "K1ABC 599 001", "PY5XT K1ABC 599 001"]) assert.equal(parseContestTransmission(text, context).kind, text.includes("PY5XT") ? "send-call-and-exchange" : "send-exchange");
});

test("interpreta pedidos, TU e cópia parcial sem adivinhar", () => {
  assert.equal(parseContestTransmission("AGN?", context).kind, "request-again");
  assert.equal(parseContestTransmission("CALL?", context).kind, "request-call");
  assert.equal(parseContestTransmission("NR?", context).kind, "request-number");
  assert.equal(parseContestTransmission("R 001 TU", context).kind, "send-tu");
  assert.deepEqual(parseContestTransmission("PY5?T", context), { kind: "call-station", copiedCall: "PY5?T" });
  assert.equal(parseContestTransmission("599", context).kind, "unknown");
});
