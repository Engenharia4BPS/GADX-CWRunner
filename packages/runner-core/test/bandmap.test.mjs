import assert from "node:assert/strict";
import test from "node:test";
import { BANDMAP_40M, BandmapEngine, createSeededRandom, VirtualVfo } from "../src/bandmap.ts";

const callsigns = Array.from({ length: 20 }, (_, index) => `PY${index % 10}T${String(index).padStart(2, "0")}`);
const options = { baseWpm: 30, baseToneHz: 600, spottedAt: 1_800_000_000_000 };

test("gera 15 estações únicas, dentro da faixa e com distância mínima", () => {
  const engine = new BandmapEngine(createSeededRandom(2025));
  const stations = engine.generate(callsigns, options);
  assert.equal(stations.length, 15);
  assert.equal(new Set(stations.map(({ callsign }) => callsign)).size, 15);
  for (const station of stations) {
    assert.ok(station.frequencyKhz > BANDMAP_40M.lowerKhz);
    assert.ok(station.frequencyKhz < BANDMAP_40M.upperKhz);
    assert.ok(station.wpm >= 27 && station.wpm <= 33);
    assert.ok(station.toneHz >= 570 && station.toneHz <= 630);
  }
  for (let index = 1; index < stations.length; index += 1) {
    assert.ok(stations[index].frequencyKhz - stations[index - 1].frequencyKhz >= BANDMAP_40M.minimumSpacingKhz);
  }
});

test("a geração com seed é determinística", () => {
  const first = new BandmapEngine(createSeededRandom(73)).generate(callsigns, options);
  const second = new BandmapEngine(createSeededRandom(73)).generate(callsigns, options);
  assert.deepEqual(first, second);
});

test("seleciona estação, atualiza VFO e navega com retorno circular", () => {
  const engine = new BandmapEngine(createSeededRandom(8));
  const stations = engine.generate(callsigns, options);
  const vfo = new VirtualVfo();
  const first = engine.select(stations[0].id);
  assert.equal(first?.status, "selected");
  assert.equal(vfo.tune(first.frequencyKhz), first.frequencyKhz);
  assert.equal(engine.adjacent(1)?.id, stations[1].id);
  assert.equal(engine.select(stations.at(-1).id)?.id, stations.at(-1).id);
  assert.equal(engine.adjacent(1)?.id, stations[0].id);
  assert.equal(engine.adjacent(-1)?.id, stations.at(-2).id);
});

test("navegação ignora worked quando há estação disponível", () => {
  const engine = new BandmapEngine(createSeededRandom(9));
  const stations = engine.generate(callsigns, options);
  engine.select(stations[0].id);
  engine.markWorked(stations[1].id);
  assert.equal(engine.adjacent(1)?.id, stations[2].id);
});
