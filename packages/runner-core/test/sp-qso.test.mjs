import assert from "node:assert/strict";
import test from "node:test";
import { compareCallsign, INITIAL_SP_QSO_STATE, createSpQsoScenario, reduceSpQso } from "../src/sp-qso.ts";

const base = (incidents = []) => ({ stationCall: "K1ABC", operatorCall: "PY5XT", exchange: "123", incidents });
const effect = (transition, type) => transition.effects.find((item) => item.type === type);

test("comparador de indicativos aceita parcial, curinga e uma correcao", () => {
  assert.equal(compareCallsign("K1ABC", "K1ABC"), "exact");
  for (const value of ["K1A", "ABC", "K1?", "K1ABD", "K1AC"]) assert.equal(compareCallsign(value, "K1ABC"), "almost");
  assert.equal(compareCallsign("W1AW", "K1ABC"), "wrong");
  assert.equal(compareCallsign("K", "K1ABC"), "wrong");
});

function step(state, event) {
  return reduceSpQso(state, event);
}

function normalToReceiving(scenario = base()) {
  let result = step(INITIAL_SP_QSO_STATE, { type: "start", scenario, serial: "001" });
  result = step(result.state, { type: "operator-call" });
  result = step(result.state, { type: "operator-finished" });
  assert.equal(effect(result, "play-station").message, "exchange");
  return step(result.state, { type: "station-finished", message: "exchange" });
}

test("QSO normal registra uma vez somente apos TU", () => {
  let result = normalToReceiving();
  assert.equal(result.state.phase, "receiving-exchange");
  result = step(result.state, { type: "operator-exchange", call: "K1ABC", rst: "599", exchange: "123" });
  assert.equal(effect(result, "play-operator").text, "5NN 001");
  result = step(result.state, { type: "operator-finished" });
  assert.equal(effect(result, "play-station").message, "tu");
  result = step(result.state, { type: "station-finished", message: "tu" });
  assert.equal(result.state.phase, "completed");
  assert.ok(effect(result, "register-qso"));
  assert.ok(effect(result, "mark-worked"));
  const again = step(result.state, { type: "station-finished", message: "tu" });
  assert.equal(effect(again, "register-qso"), undefined);
});

test("estacao ocupada retorna ao CQ sem registrar QSO", () => {
  let result = step(INITIAL_SP_QSO_STATE, { type: "start", scenario: base(["busy"]), serial: "001" });
  result = step(result.state, { type: "operator-call" });
  result = step(result.state, { type: "operator-finished" });
  assert.equal(result.state.phase, "station-busy");
  result = step(result.state, { type: "station-finished", message: "busy" });
  assert.equal(result.state.phase, "listening-cq");
  assert.ok(effect(result, "restart-cq"));
  assert.equal(effect(result, "register-qso"), undefined);
});

test("primeira chamada ignorada retorna ao CQ e a segunda recebe intercambio", () => {
  let result = step(INITIAL_SP_QSO_STATE, { type: "start", scenario: base(["ignore-first-call"]), serial: "001" });
  result = step(result.state, { type: "operator-call" });
  result = step(result.state, { type: "operator-finished" });
  assert.equal(result.state.phase, "listening-cq");
  assert.ok(effect(result, "restart-cq"));
  result = step(result.state, { type: "operator-call" });
  result = step(result.state, { type: "operator-finished" });
  assert.equal(effect(result, "play-station").message, "exchange");
});

for (const [incident, request, response] of [["request-agn", "station-requesting-again", "operator-repeat"], ["request-call", "station-requesting-call", "operator-call"]]) {
  test(`pedido ${incident} e resposta contextual concluem o fluxo`, () => {
    let result = step(INITIAL_SP_QSO_STATE, { type: "start", scenario: base([incident]), serial: "001" });
    result = step(result.state, { type: "operator-call" });
    result = step(result.state, { type: "operator-finished" });
    assert.equal(result.state.phase, request);
    const event = response === "operator-exchange" ? { type: response, call: "", rst: "", exchange: "" } : { type: response };
    result = step(result.state, event);
    assert.equal(effect(result, "play-operator")?.text, response === "operator-exchange" ? "5NN 001" : "PY5XT");
  });
}

test("F8, F9 e F10 transmitem primeiro a macro do operador", () => {
  for (const [event, text, message] of [["operator-agn", "AGN", "exchange"], ["operator-number-request", "NR?", "number"], ["operator-call-request", "CALL?", "call"]]) {
    let result = step(normalToReceiving().state, { type: event });
    assert.equal(effect(result, "play-operator")?.text, text);
    result = step(result.state, { type: "operator-finished" });
    assert.equal(effect(result, "play-station")?.message, message);
    assert.doesNotMatch(effect(result, "status")?.label ?? "", /123/);
    result = step(result.state, { type: "station-finished", message });
    assert.equal(result.state.phase, "receiving-exchange");
  }
});

test("request-number ocorre somente depois do intercambio do operador", () => {
  let result = normalToReceiving(base(["request-number"]));
  assert.equal(result.state.phase, "receiving-exchange");
  result = step(result.state, { type: "operator-send-exchange" });
  result = step(result.state, { type: "operator-finished" });
  assert.equal(result.state.phase, "station-requesting-number");
  assert.equal(effect(result, "play-station")?.text, "NR?");
  result = step(result.state, { type: "operator-send-exchange" });
  result = step(result.state, { type: "operator-finished" });
  assert.equal(effect(result, "play-station")?.message, "tu");
});

test("intercambio anotado incorretamente nao bloqueia a transmissao", () => {
  const result = step(normalToReceiving().state, { type: "operator-exchange", call: "K1ABC", rst: "599", exchange: "999" });
  assert.equal(result.state.phase, "sending-our-exchange");
  assert.ok(effect(result, "play-operator"));
  assert.equal(effect(result, "register-qso"), undefined);
  assert.doesNotMatch(effect(result, "status").label, /123/);
});

test("F2 envia o serial atual sem registrar o contato sozinho", () => {
  const result = step(normalToReceiving().state, { type: "operator-send-exchange" });
  assert.equal(result.state.phase, "sending-our-exchange");
  assert.equal(effect(result, "play-operator").text, "5NN 001");
  assert.equal(effect(result, "register-qso"), undefined);
});

test("cenario e deterministico quando a fonte aleatoria e injetada", () => {
  const values = [0.1, 0.1, 0.01, 0.6, 0.99];
  let index = 0;
  const random = () => values[index++] ?? 0.5;
  const scenario = createSpQsoScenario("k1abc", "py5xt", "7", random);
  assert.equal(scenario.stationCall, "K1ABC");
  assert.equal(scenario.exchange, "007");
  assert.equal(scenario.incidents.length, 2);
});

test("abortar QSO incompleto nao registra e limpa a entrada", () => {
  const result = step(normalToReceiving().state, { type: "abort" });
  assert.equal(result.state.phase, "aborted");
  assert.ok(effect(result, "clear-entry"));
  assert.equal(effect(result, "register-qso"), undefined);
});
