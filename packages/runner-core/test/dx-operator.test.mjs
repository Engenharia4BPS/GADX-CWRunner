import assert from "node:assert/strict";
import test from "node:test";
import { createDxOperatorState, reduceDxOperator } from "../src/dx-operator.ts";

const profile = (overrides = {}) => ({
  patience: 3,
  wpm: 30,
  responseDelayMs: 160,
  replyTimeoutMs: 8000,
  callCopyPolicy: { model: "morse", skill: 3, acceptAlmost: false, rejectExact: false },
  repeatsExchangeOnTimeout: false,
  ...overrides,
});
const call = (heardOperatorCall) => ({ type: "operator-call", expectedOperatorCall: "PY5XT", heardOperatorCall, exchangeText: "PY5XT 5NN 123" });

test("operador correto recebe exchange e passa a aguardar número", () => {
  const result = reduceDxOperator(createDxOperatorState(profile()), profile(), call("PY5XT"));
  assert.deepEqual(result.decision, { type: "send-exchange", text: "PY5XT 5NN 123" });
  assert.equal(result.state.logical, "need-number");
});

test("indicativo incorreto consome paciência e pede CALL?", () => {
  const result = reduceDxOperator(createDxOperatorState(profile()), profile(), call("W1AW"));
  assert.deepEqual(result.decision, { type: "request-call", text: "CALL?" });
  assert.equal(result.state.patience, 2);
});

test("cópia parcial aceita pela política segue para o exchange", () => {
  const tolerant = profile({ callCopyPolicy: { model: "morse", skill: 3, acceptAlmost: true, rejectExact: false } });
  const result = reduceDxOperator(createDxOperatorState(tolerant), tolerant, call("PY5?T"));
  assert.equal(result.decision.type, "send-exchange");
  assert.equal(result.state.logical, "need-number");
});

test("timeout consome paciência uma vez e pede ou repete o dado configurado", () => {
  const normal = profile();
  const afterExchange = reduceDxOperator(createDxOperatorState(normal), normal, call("PY5XT")).state;
  const requested = reduceDxOperator(afterExchange, normal, { type: "reply-timeout", exchangeText: "PY5XT 5NN 123" });
  assert.deepEqual(requested.decision, { type: "request-number", text: "NR?" });
  assert.equal(requested.state.patience, 2);
  const repeating = reduceDxOperator(afterExchange, profile({ repeatsExchangeOnTimeout: true }), { type: "reply-timeout", exchangeText: "PY5XT 5NN 123" });
  assert.equal(repeating.decision.type, "send-exchange");
});

test("paciência esgotada falha", () => {
  const impatient = profile({ patience: 1 });
  const result = reduceDxOperator(createDxOperatorState(impatient), impatient, call("W1AW"));
  assert.equal(result.decision.type, "failed");
  assert.equal(result.state.logical, "failed");
});

test("mesma entrada e perfil produzem a mesma decisão sem efeitos externos", () => {
  const first = reduceDxOperator(createDxOperatorState(profile()), profile(), call("PY5XT"));
  const second = reduceDxOperator(createDxOperatorState(profile()), profile(), call("PY5XT"));
  assert.deepEqual(first, second);
});

test("exchange do operador gera confirmação e finalização da estação conclui o DX Operator", () => {
  const configured = profile();
  const afterCall = reduceDxOperator(createDxOperatorState(configured), configured, call("PY5XT")).state;
  const acknowledgement = reduceDxOperator(afterCall, configured, { type: "operator-exchange", acknowledgementText: "TU" });
  assert.deepEqual(acknowledgement.decision, { type: "acknowledge", text: "TU" });
  assert.equal(acknowledgement.state.logical, "need-end");
  const done = reduceDxOperator(acknowledgement.state, configured, { type: "station-finalized" });
  assert.deepEqual(done.decision, { type: "wait" });
  assert.equal(done.state.logical, "done");
});

test("finalização da estação fora de need-end não altera o estado", () => {
  const configured = profile();
  const state = createDxOperatorState(configured);
  assert.deepEqual(
    reduceDxOperator(state, configured, { type: "station-finalized" }),
    { state, decision: { type: "wait" } },
  );
});

test("eventos após done ou failed são inertes", () => {
  const configured = profile();
  const done = { ...createDxOperatorState(configured), logical: "done" };
  const failed = { ...createDxOperatorState(configured), logical: "failed" };
  assert.deepEqual(reduceDxOperator(done, configured, call("PY5XT")), { state: done, decision: { type: "wait" } });
  assert.deepEqual(reduceDxOperator(failed, configured, { type: "station-finalized" }), { state: failed, decision: { type: "wait" } });
});
