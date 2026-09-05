import assert from "node:assert/strict";
import test from "node:test";
import { advanceSandpWorld, markSandpStationBusy, markSandpStationFailed, markSandpStationQsy, markSandpStationWorked, selectSandpStation, setSandpQsoActive, startSandpWorld } from "../src/sandp-world.ts";
import { createAudioScene } from "../src/audio.ts";

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

test("perfil RF reproduzível persiste e fica em faixas seguras", () => {
  const values = [.1, .2, .3, .4, .9, .8, .7, .6, .5, .4, .3, .2, .1, .9, .8, .7, .6, .5, .4, .3];
  const first = startSandpWorld(spots, "PY5XT", 0, sequence(values));
  const second = startSandpWorld(spots, "PY5XT", 0, sequence(values));
  assert.deepEqual(first.stations.map((station) => station.rfProfile), second.stations.map((station) => station.rfProfile));
  assert.notDeepEqual(first.stations[0].rfProfile, first.stations[1].rfProfile);
  for (const station of first.stations) {
    const rf = station.rfProfile;
    assert.ok(rf.toneHz >= 300 && rf.toneHz <= 1000);
    assert.ok(rf.signalGain >= .28 && rf.signalGain <= .9);
    assert.ok(rf.frequencyDriftHz >= .8 && rf.frequencyDriftHz <= 3.2);
    assert.ok(rf.fadingDepth >= .08 && rf.fadingDepth <= .32);
    assert.ok(rf.fadingCycleSeconds >= 1.5 && rf.fadingCycleSeconds <= 4);
  }
  const after = markSandpStationBusy(first, "a", 0, () => .5);
  assert.equal(after.stations[0].rfProfile, first.stations[0].rfProfile);
});

test("plano RF explícito chega ao áudio sem novo sorteio", () => {
  const rf = { toneHz: 715, signalGain: .43, frequencyDriftHz: 2.1, fadingDepth: .2, fadingCycleSeconds: 3.4 };
  const settings = { enabled: false, qrnLevel: 0, qrmLevel: 0, signalVariation: false, frequencyVariation: false, slowFading: false, stationSpeedVariation: false, stationCount: 1 };
  const scene = createAudioScene(["K1ABC"], 30, 600, settings, () => { throw new Error("não deve sortear RF"); }, rf);
  const station = scene.stations[0];
  assert.deepEqual({ toneHz: station.toneHz, gain: station.gain, frequencyDriftHz: station.frequencyDriftHz, fadingDepth: station.fadingDepth, fadingCycleSeconds: station.fadingCycleSeconds }, { toneHz: 715, gain: .43, frequencyDriftHz: 2.1, fadingDepth: .2, fadingCycleSeconds: 3.4 });
});

test("ciclo CQ, QSO e cooldown preserva cenário e RF", () => {
  const world = startSandpWorld(spots, "PY5XT", 0, sequence(Array(40).fill(.9)));
  const station = { ...world.stations[0], activity: "calling-cq", nextTransitionAtMs: 100, behavior: { ...world.stations[0].behavior, workingDurationMs: 200, cqDurationMs: 300, cooldownDurationMs: 150, qsyProbability: 0 } };
  const ready = { ...world, stations: [station, world.stations[1]] };
  const working = advanceSandpWorld(ready, 100, () => .9);
  assert.equal(working.stations[0].activity, "working-other");
  assert.equal(working.stations[0].scenario, station.scenario);
  assert.equal(working.stations[0].rfProfile, station.rfProfile);
  const calling = advanceSandpWorld(working, 300, () => .9);
  assert.equal(calling.stations[0].activity, "calling-cq");
  const cooldown = markSandpStationFailed(calling, "a", 300, () => .9);
  assert.equal(cooldown.stations[0].activity, "cooldown");
  assert.equal(advanceSandpWorld(cooldown, 450, () => .9).stations[0].activity, "calling-cq");
});

test("QSY autônomo é raro, limitado a duas estações e não toca a ativa", () => {
  const many = [...spots, { ...spots[0], id: "c", callsign: "N1ZZ" }];
  const world = startSandpWorld(many, "PY5XT", 0, sequence(Array(60).fill(.9)));
  const primed = { ...world, stations: world.stations.map((station) => ({ ...station, activity: "calling-cq", nextTransitionAtMs: 100, behavior: { ...station.behavior, qsyProbability: 1 } })) };
  const first = advanceSandpWorld(primed, 100, () => 0);
  assert.equal(first.autonomousQsyCount, 2);
  assert.equal(first.stations.filter((station) => station.activity === "qsy").length, 2);
  const active = setSandpQsoActive({ ...primed, stations: primed.stations.map((station, index) => index === 0 ? station : { ...station, activity: "working-other", nextTransitionAtMs: 500 }) }, "a");
  assert.equal(advanceSandpWorld(active, 100, () => 0).stations[0].activity, "calling-cq");
});

test("perfis precise e impatient têm ciclos e paciência coerentes", () => {
  const world = startSandpWorld(spots, "PY5XT", 0, sequence(Array(40).fill(.9)));
  const precise = { ...world.stations[0], profile: { ...world.stations[0].profile, style: "precise" }, behavior: { cqDurationMs: 60_000, workingDurationMs: 42_000, cooldownDurationMs: 7_000, qsyProbability: .01, patience: 6 } };
  const impatient = { ...world.stations[1], profile: { ...world.stations[1].profile, style: "impatient" }, behavior: { cqDurationMs: 18_000, workingDurationMs: 15_000, cooldownDurationMs: 20_000, qsyProbability: .04, patience: 2 } };
  assert.ok(precise.behavior.cqDurationMs > impatient.behavior.cqDurationMs);
  assert.ok(precise.behavior.workingDurationMs > impatient.behavior.workingDurationMs);
  assert.ok(precise.behavior.patience > impatient.behavior.patience);
  assert.ok(precise.behavior.qsyProbability < impatient.behavior.qsyProbability);
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
