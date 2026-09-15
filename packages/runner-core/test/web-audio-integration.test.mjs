import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const trainingSource = await readFile(new URL("../../../apps/web/src/training.ts", import.meta.url), "utf8");
const cwAudioSource = await readFile(new URL("../../../apps/web/src/cw-audio.ts", import.meta.url), "utf8");
const rxAudioSource = await readFile(new URL("../../../apps/web/src/rx-environment.ts", import.meta.url), "utf8");
const callsignSource = await readFile(new URL("../../../apps/web/src/callsign-source.ts", import.meta.url), "utf8");
const bandmapViewSource = await readFile(new URL("../../../apps/web/src/bandmap-view.ts", import.meta.url), "utf8");
const spControllerSource = await readFile(new URL("../../../apps/web/src/sp-qso-controller.ts", import.meta.url), "utf8");

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

test("atividade de faixa é separada do primeiro plano e cancelada por ele", () => {
  assert.match(cwAudioSource, /private readonly bandSources/);
  assert.match(cwAudioSource, /playBandActivity\(text/);
  assert.match(cwAudioSource, /this\.stopBandActivity\(\)/);
  assert.match(trainingSource, /preferences\.bandActivity/);
  assert.match(trainingSource, /scheduleBandActivity/);
  assert.match(trainingSource, /planBandActivity/);
});

test("Esc interrompe a transmissão sem encerrar o treino", () => {
  assert.match(trainingSource, /Escape: interruptMacroTransmission/);
  assert.match(functionLine(trainingSource, "interruptMacroTransmission"), /audioEngine\?\.stop\(\)/);
  assert.doesNotMatch(functionLine(trainingSource, "interruptMacroTransmission"), /stopAll|endSession/);
  assert.match(functionLine(trainingSource, "stopTransmission"), /audioEngine\?\.stopAll\(\)/);
  assert.match(functionLine(trainingSource, "startSession"), /startEnvironment\(rxEnvironmentSettings\(\), preferences\.toneHz\)/);
  assert.match(rxAudioSource, /this\.clearTimers\(\)/);
  assert.match(rxAudioSource, /this\.finishStop\(\)/);
});

test("macros aceitam RST e serial tradicionais ou CUT", () => {
  const expansion = functionLine(trainingSource, "expandedFunctionMessage");
  assert.match(expansion, /RST-CUT/);
  assert.match(expansion, /SERIAL-CUT/);
  assert.match(expansion, /abbreviateCwNumbers/);
});

test("teclas de função oferecem prévia CW antes de iniciar o treino", () => {
  assert.match(functionLine(trainingSource, "macro"), /if \(!running\(\)\) \{ await previewMacro\(key\); return; \}/);
  assert.match(functionLine(trainingSource, "previewMacro"), /await unlockAudio\(\)/);
  assert.match(functionLine(trainingSource, "previewMacro"), /transmit\(text\)/);
  assert.match(functionLine(trainingSource, "expandedFunctionMessage"), /preview = false/);
});

test("referência do alfabeto Morse fica disponível no cabeçalho", () => {
  assert.match(trainingSource, /id="morse-reference"/);
  assert.match(trainingSource, /id="morse-reference-dialog"/);
  assert.match(trainingSource, /MORSE_REFERENCE_GROUPS/);
  assert.match(trainingSource, /MORSE_CODE\[symbol\]/);
  assert.match(trainingSource, /openMorseReference/);
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

test("troca RUN/S&P preserva o fluxo RUN e não cria outro motor de áudio", () => {
  assert.match(trainingSource, /type OperatingMode/);
  assert.match(trainingSource, /switchOperatingMode\("RUN"\)/);
  assert.match(trainingSource, /switchOperatingMode\("S_AND_P"\)/);
  assert.match(functionLine(trainingSource, "startSession"), /operatingMode === "S_AND_P"/);
  assert.match(functionLine(trainingSource, "startSession"), /callCq\(\)/);
  assert.equal((trainingSource.match(/new CwAudioEngine/g) ?? []).length, 1);
});

test("Bandmap usa indicativos HTML clicáveis e protege o indicativo principal do QRM", () => {
  assert.match(bandmapViewSource, /document\.createElement\("button"\)/);
  assert.match(trainingSource, /setQrmCallsigns\(callsignDatabase, \[station\.callsign\]\)/);
  assert.match(trainingSource, /selectCallsigns\(BANDMAP_40M\.stationCount, \[preferences\.operatorCall\]\)/);
});

test("controle S&P invalida callbacks antigos ao abortar ou trocar de estação", () => {
  assert.match(spControllerSource, /private generation = 0/);
  assert.match(spControllerSource, /generation === this\.generation/);
  assert.match(spControllerSource, /this\.timers\.forEach/);
  assert.match(trainingSource, /spQsoController\.abort\(\)/);
  assert.match(trainingSource, /spQsoController\.begin\(/);
});

test("F2 preserva a entrada atual e pedidos S&P passam pelo CW do operador", () => {
  assert.match(spControllerSource, /this\.entry = \{ \.\.\.entry \}/);
  assert.match(spControllerSource, /const playStation = \(\): void/);
  assert.match(spControllerSource, /this\.defer\(playStation, effect\.delayMs\)/);
  assert.match(spControllerSource, /const duration = this\.ports\.playStation\(effect\.text, this\.state\.scenario\?\.wpm \?\? 30\)/);
  assert.doesNotMatch(spControllerSource, /duration \+ 80 \+ \(effect\.delayMs/);
  assert.match(trainingSource, /spQsoController\.macro\(key, \{ call: callsign\.value/);
});
