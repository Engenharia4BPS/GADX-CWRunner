import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const trainingSource = await readFile(new URL("../../../apps/web/src/training.ts", import.meta.url), "utf8");
const cwAudioSource = await readFile(new URL("../../../apps/web/src/cw-audio.ts", import.meta.url), "utf8");
const rxAudioSource = await readFile(new URL("../../../apps/web/src/rx-environment.ts", import.meta.url), "utf8");
const callsignSource = await readFile(new URL("../../../apps/web/src/callsign-source.ts", import.meta.url), "utf8");

function functionLine(source, name) {
  return source.split("\n").find((line) => line.includes(`function ${name}`)) ?? "";
}

test("F6 e conclusão do QSO não reiniciam o ambiente", () => {
  assert.doesNotMatch(functionLine(trainingSource, "repeat"), /\.(?:start|stop|update)Environment/);
  assert.doesNotMatch(functionLine(trainingSource, "finishQso"), /\.(?:start|stop|update)Environment/);
});

test("cada transmissão para somente o CW transitório", () => {
  const playMethod = cwAudioSource.match(/play\(texts[\s\S]*?private scheduleStation/)?.[0] ?? "";
  assert.match(playMethod, /this\.stop\(\)/);
  assert.doesNotMatch(playMethod, /stopAll|stopEnvironment/);
});

test("Esc encerra CW, ambiente e timers; nova sessão restaura uma vez", () => {
  assert.match(trainingSource, /Escape: \(\) => endSession\(\)/);
  assert.match(functionLine(trainingSource, "stopTransmission"), /audioEngine\?\.stopAll\(\)/);
  assert.match(functionLine(trainingSource, "startSession"), /startEnvironment\(rxEnvironmentSettings\(\), preferences\.toneHz\)/);
  assert.match(rxAudioSource, /this\.clearTimers\(\)/);
  assert.match(rxAudioSource, /this\.finishStop\(\)/);
});

test("preferências do ambiente são persistidas no armazenamento existente", () => {
  for (const field of ["rxEnvironment", "rxPreset", "bandNoiseLevel", "qrnLevel", "qrmLevel", "stationCount"]) {
    assert.match(trainingSource, new RegExp(field));
  }
  assert.match(trainingSource, /localStorage\.setItem\(storageKey/);
});

test("base de indicativos usa BASE_URL e uma única promise em memória", () => {
  assert.match(callsignSource, /import\.meta\.env\.BASE_URL/);
  assert.match(callsignSource, /data\/callsigns\.cqww-2025cw\.json/);
  assert.match(callsignSource, /databasePromise \?\?= fetch\(databaseUrl\)/);
  assert.match(callsignSource, /new CallsignSelector\(callsigns, generatePlausibleCallsign\)/);
  assert.doesNotMatch(callsignSource, /console\.(?:debug|log|warn|error)/);
});
