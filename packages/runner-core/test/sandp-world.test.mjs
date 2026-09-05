import assert from "node:assert/strict";
import test from "node:test";
import { advanceSandpWorld, markSandpStationBusy, markSandpStationFailed, markSandpStationQsy, markSandpStationWorked, selectSandpStation, setSandpQsoActive, startSandpWorld } from "../src/sandp-world.ts";

const spots = [{ id: "a", callsign: "K1ABC", frequencyKhz: 7010, wpm: 30, toneHz: 600, signalDb: -8, spottedAt: 0, status: "available" }, { id: "b", callsign: "W1AW", frequencyKhz: 7020, wpm: 32, toneHz: 620, signalDb: -10, spottedAt: 0, status: "available" }];
const sequence = (values) => { let index = 0; return () => values[index++] ?? .9; };

test("mundo S&P e deterministico e preserva o mesmo cenário por spot", () => {
  const first = startSandpWorld(spots, "PY5XT", 1000, sequence([.9, .9, .9, .9, .9, .9, .9, .9, .9, .9, .9, .9]));
  const second = startSandpWorld(spots, "PY5XT", 1000, sequence([.9, .9, .9, .9, .9, .9, .9, .9, .9, .9, .9, .9]));
  assert.deepEqual(first, second);
  const selected = selectSandpStation(first, "a", 2000);
  assert.equal(selected.stations[0].scenario, first.stations[0].scenario);
});

test("ocupada, worked, qsy e estação ativa respeitam as transições", () => {
  const world = startSandpWorld(spots, "PY5XT", 0, sequence([.9, .9, .9, .9, .9, .9, .9, .9, .9, .9, .9, .9]));
  const busy = { ...world, stations: [{ ...world.stations[0], activity: "working-other", nextTransitionAtMs: 100 }, world.stations[1]] };
  assert.equal(selectSandpStation(busy, "a", 0).selectedStationId, "a");
  assert.equal(advanceSandpWorld(busy, 99, () => .5).stations[0].activity, "working-other");
  assert.equal(advanceSandpWorld(busy, 100, () => .5).stations[0].activity, "calling-cq");
  const active = setSandpQsoActive(busy, "a");
  assert.equal(advanceSandpWorld(active, 1000, () => .5).stations[0].activity, "working-other");
  const worked = markSandpStationWorked(world, "a", 0);
  assert.equal(advanceSandpWorld(worked, 99_999, () => .5).stations[0].activity, "worked");
  assert.equal(selectSandpStation(markSandpStationQsy(world, "b"), "b", 0).selectedStationId, undefined);
  assert.equal(markSandpStationFailed(world, "a", 0, () => .5).stations[0].activity, "cooldown");
});

test("BUSY é persistente, libera a estação ativa e preserva cenário", () => {
  const world = startSandpWorld(spots, "PY5XT", 0, sequence([.9, .9, .9, .9, .9, .9, .9, .9, .9, .9, .9, .9]));
  const active = setSandpQsoActive(world, "a");
  const busy = markSandpStationBusy(active, "a", 1000, () => .5);
  assert.equal(busy.stations[0].activity, "working-other");
  assert.equal(busy.activeStationId, undefined);
  assert.equal(busy.stations[0].scenario, world.stations[0].scenario);
  assert.ok(busy.stations[0].nextTransitionAtMs > 1000);
  assert.equal(advanceSandpWorld(busy, busy.stations[0].nextTransitionAtMs - 1, () => .1).stations[0].activity, "working-other");
  assert.equal(advanceSandpWorld(busy, busy.stations[0].nextTransitionAtMs, () => .1).stations[0].activity, "calling-cq");
});

test("BUSY e ticks não alteram worked ou qsy e falha continua cooldown", () => {
  const world = startSandpWorld(spots, "PY5XT", 0, sequence([.9, .9, .9, .9, .9, .9, .9, .9, .9, .9, .9, .9]));
  const worked = markSandpStationWorked(world, "a", 0);
  assert.equal(markSandpStationBusy(worked, "a", 0, () => .5), worked);
  const qsy = markSandpStationQsy(world, "b");
  assert.equal(markSandpStationBusy(qsy, "b", 0, () => .5), qsy);
  assert.equal(advanceSandpWorld(qsy, 99_999, () => .5).stations[1].activity, "qsy");
  assert.equal(markSandpStationFailed(world, "a", 0, () => .5).stations[0].activity, "cooldown");
});
