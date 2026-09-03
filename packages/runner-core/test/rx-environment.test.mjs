import assert from "node:assert/strict";
import test from "node:test";
import { createAudioScene } from "../src/audio.ts";
import {
  createQrmEvent,
  createQrnEvent,
  restoreRxEnvironment,
  RX_PRESETS,
  RxEnvironmentLifecycle,
} from "../src/rx-environment.ts";

function sequenceRandom(values) {
  let index = 0;
  return () => values[index++ % values.length];
}

test("presets possuem os níveis definidos para a banda", () => {
  assert.deepEqual(RX_PRESETS.clean, { bandNoiseLevel: 0.05, qrnLevel: 0, qrmLevel: 0 });
  assert.deepEqual(RX_PRESETS.normal, { bandNoiseLevel: 0.18, qrnLevel: 0.15, qrmLevel: 0 });
  assert.deepEqual(RX_PRESETS.noisy, { bandNoiseLevel: 0.3, qrnLevel: 0.35, qrmLevel: 0.15 });
  assert.deepEqual(RX_PRESETS.contest, { bandNoiseLevel: 0.25, qrnLevel: 0.25, qrmLevel: 0.45 });
});

test("preferências RX são restauradas e migram o toggle antigo", () => {
  const restored = restoreRxEnvironment({ preset: "contest", bandNoiseLevel: 0.4, stationCount: 3 }, true);
  assert.equal(restored.enabled, true);
  assert.equal(restored.preset, "contest");
  assert.equal(restored.bandNoiseLevel, 0.4);
  assert.equal(restored.qrnLevel, 0.25);
  assert.equal(restored.qrmLevel, 0.45);
  assert.equal(restored.stationCount, 3);
});

test("lifecycle impede ruídos duplicados e restaura uma única vez", () => {
  const lifecycle = new RxEnvironmentLifecycle();
  assert.equal(lifecycle.start(true), true);
  assert.equal(lifecycle.start(true), false);
  assert.equal(lifecycle.active, true);
  assert.equal(lifecycle.stop(), true);
  assert.equal(lifecycle.stop(), false);
  assert.equal(lifecycle.start(true), true);
  assert.equal(lifecycle.start(true), false);
});

test("QRN usa intervalos não periódicos e rajadas variáveis", () => {
  const first = createQrnEvent(0.35, sequenceRandom([0.1, 0.2, 0.3, 0.4, 0.5, 0.6]));
  const second = createQrnEvent(0.35, sequenceRandom([0.9, 0.8, 0.7, 0.6, 0.5, 0.4]));
  assert.notEqual(first.delaySeconds, second.delaySeconds);
  assert.notEqual(first.pulses, second.pulses);
  assert.ok(first.delaySeconds > 0);
  assert.ok(second.durationSeconds > 0);
});

test("QRM respeita o máximo de estações, offsets e texto excluído", () => {
  const event = createQrmEvent(1, 3, ["CQ TEST"], sequenceRandom([0, 0.2, 0.8, 0.4, 0.6, 0.3, 0.7, 0.5, 0.9]));
  assert.equal(event.signals.length, 3);
  for (const signal of event.signals) {
    assert.notEqual(signal.text, "CQ TEST");
    assert.ok(Math.abs(signal.frequencyOffsetHz) >= 120);
    assert.ok(Math.abs(signal.frequencyOffsetHz) <= 800);
    assert.ok(signal.gain < 0.5);
  }
});

test("QRM nunca escolhe o indicativo principal atual", () => {
  const event = createQrmEvent(1, 3, ["PY5XT"], () => 0, ["PY5XT", "K1ABC", "DL2ZZZ"]);
  assert.equal(event.signals.some((signal) => signal.text === "PY5XT"), false);
});

test("CW limpo mantém WPM e tom quando Ambiente RX está desligado", () => {
  const scene = createAudioScene(["PY5XT", "LU1ABC"], 27, 650, {
    enabled: false,
    qrnLevel: 1,
    qrmLevel: 1,
    signalVariation: true,
    frequencyVariation: true,
    slowFading: true,
    stationSpeedVariation: true,
    stationCount: 3,
  }, () => 0);
  assert.equal(scene.stations.length, 1);
  assert.equal(scene.stations[0].wpm, 27);
  assert.equal(scene.stations[0].toneHz, 650);
  assert.equal(scene.qrnLevel, 0);
  assert.equal(scene.qrmLevel, 0);
});
