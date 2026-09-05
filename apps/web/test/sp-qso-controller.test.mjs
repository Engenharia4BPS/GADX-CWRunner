import assert from "node:assert/strict";
import test from "node:test";
import { createSpQsoScenario } from "@gadx/runner-core";
import { SpQsoController } from "../src/sp-qso-controller.ts";

function fakePorts() {
  let nextTimer = 1;
  const timers = new Map();
  const operator = [];
  const station = [];
  return {
    operator,
    station,
    ports: {
      playOperator: (text) => { operator.push(text); return 100; },
      playStation: (text, wpm) => { station.push(`${text}@${wpm}`); return 100; },
      stopCw: () => {}, schedule: (action, delayMs) => { const id = nextTimer++; timers.set(id, { action, delayMs }); return id; },
      cancelSchedule: (id) => { timers.delete(id); }, status: () => {}, clearEntry: () => {}, registerQso: () => {}, recordError: () => {}, markWorked: () => {}, restartCq: () => {},
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
