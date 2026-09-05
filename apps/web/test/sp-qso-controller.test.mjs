import assert from "node:assert/strict";
import test from "node:test";
import { createSpQsoScenario } from "@gadx/runner-core";
import { SpQsoController } from "../src/sp-qso-controller.ts";

function fakePorts() {
  let nextTimer = 1;
  const timers = new Map();
  const operator = [];
  const station = [];
  const registered = [];
  return {
    operator,
    station,
    registered,
    ports: {
      playOperator: (text) => { operator.push(text); return 100; },
      playStation: (text, wpm) => { station.push(`${text}@${wpm}`); return 100; },
      stopCw: () => {}, schedule: (action, delayMs) => { const id = nextTimer++; timers.set(id, { action, delayMs }); return id; },
      cancelSchedule: (id) => { timers.delete(id); }, status: () => {}, clearEntry: () => {}, registerQso: (result) => { registered.push(result); }, recordError: () => {}, markWorked: () => {}, restartCq: () => {},
    },
    runDelay: (delayMs) => { const item = [...timers.entries()].find(([, timer]) => timer.delayMs === delayMs); assert.ok(item, `timer de ${delayMs} ms`); timers.delete(item[0]); item[1].action(); },
    hasDelay: (delayMs) => [...timers.values()].some((timer) => timer.delayMs === delayMs),
  };
}

test("F4 transmite a chamada real e atrasa CALL? de cópia parcial", () => {
  const fake = fakePorts();
  const controller = new SpQsoController(fake.ports);
  const scenario = createSpQsoScenario("K1ABC", "PY5XT", "123", () => .9);
  scenario.incidents = ["partial-operator-call"];
  scenario.profile = { style: "precise", replyTimeoutMs: 8000, acknowledgement: "tu", repeatsExchangeOnTimeout: false };
  scenario.callCopyPolicy = { model: "morse", skill: 3, acceptAlmost: false, rejectExact: false };
  scenario.wpm = 30;
  scenario.responseDelayMs = 250;
  scenario.responseDelayMs = 250;
  controller.begin(scenario, "001");
  controller.macro("F4");
  assert.deepEqual(fake.operator, ["PY5XT"]);
  assert.deepEqual(fake.station, []);
  fake.runDelay(180);
  assert.equal(controller.currentState.heardOperatorCall, "PY5?T");
  assert.deepEqual(fake.station, []);
  fake.runDelay(250);
  assert.deepEqual(fake.station, ["CALL?@30"]);
});

test("abortar antes da resposta atrasada impede o CW da estação", () => {
  const fake = fakePorts();
  const controller = new SpQsoController(fake.ports);
  const scenario = createSpQsoScenario("K1ABC", "PY5XT", "123", () => .9);
  scenario.incidents = ["partial-operator-call"];
  controller.begin(scenario, "001");
  controller.macro("F4");
  fake.runDelay(180);
  controller.abort();
  assert.deepEqual(fake.station, []);
});

test("timeout começa após o exchange e F2 o cancela", () => {
  const fake = fakePorts();
  const controller = new SpQsoController(fake.ports);
  const scenario = createSpQsoScenario("K1ABC", "PY5XT", "123", () => .9);
  scenario.profile = { style: "precise", replyTimeoutMs: 3000, acknowledgement: "tu", repeatsExchangeOnTimeout: false };
  scenario.responseDelayMs = 250;
  controller.begin(scenario, "001");
  controller.macro("F4");
  fake.runDelay(180);
  fake.runDelay(250);
  fake.runDelay(180);
  assert.ok(fake.hasDelay(3000));
  controller.macro("F2");
  assert.equal(fake.hasDelay(3000), false);
});

test("F6 sem texto e inofensivo; texto livre sempre vai para CW", () => {
  const fake = fakePorts();
  const controller = new SpQsoController(fake.ports);
  const scenario = createSpQsoScenario("K1ABC", "PY5XT", "123", () => .9);
  scenario.profile = { style: "precise", replyTimeoutMs: 3000, acknowledgement: "tu", repeatsExchangeOnTimeout: false };
  controller.begin(scenario, "001");
  controller.macro("F6");
  assert.deepEqual(fake.operator, []);
  controller.transmitText("ZZZ TESTE");
  assert.deepEqual(fake.operator, ["ZZZ TESTE"]);
  fake.runDelay(180);
  assert.deepEqual(fake.station, []);
});

function controllerReceivingExchange() {
  const fake = fakePorts();
  const scenario = createSpQsoScenario("K1ABC", "PY5XT", "123", () => .9);
  scenario.responseDelayMs = 250;
  scenario.profile = { style: "precise", replyTimeoutMs: 3000, acknowledgement: "tu", repeatsExchangeOnTimeout: false };
  scenario.callCopyPolicy = { model: "morse", skill: 3, acceptAlmost: false, rejectExact: false };
  const controller = new SpQsoController(fake.ports);
  controller.begin(scenario, "001");
  controller.macro("F4");
  fake.runDelay(180);
  fake.runDelay(250);
  fake.runDelay(180);
  assert.equal(controller.currentState.phase, "receiving-exchange");
  return { controller, fake };
}

test("Enter transmite o exchange proprio e conserva a copia da estacao", () => {
  const { controller, fake } = controllerReceivingExchange();
  controller.enter("K1ABC", "599", "123");
  assert.equal(fake.operator.at(-1), "5NN 001");
  assert.notEqual(fake.operator.at(-1), "K1ABC 599 123");
  fake.runDelay(180);
  fake.runDelay(180);
  assert.deepEqual(fake.registered, ["OK"]);
});

test("submit transmite o exchange proprio, enquanto F2 e pedidos guiados permanecem corretos", () => {
  const { controller, fake } = controllerReceivingExchange();
  controller.submit("K1ABC", "599", "123");
  assert.equal(fake.operator.at(-1), "5NN 001");
  assert.notEqual(fake.operator.at(-1), "K1ABC 599 123");

  const f2 = fakePorts();
  const scenario = createSpQsoScenario("K1ABC", "PY5XT", "123", () => .9);
  const f2Controller = new SpQsoController(f2.ports);
  f2Controller.begin(scenario, "001");
  f2Controller.macro("F2");
  assert.equal(f2.operator.at(-1), "5NN 001");

  const partial = controllerReceivingExchange();
  partial.controller.enter("K1?", "599", "123");
  assert.equal(partial.fake.operator.at(-1), "CALL?");
  const missingNumber = controllerReceivingExchange();
  missingNumber.controller.enter("K1ABC", "599", "");
  assert.equal(missingNumber.fake.operator.at(-1), "NR?");
});
