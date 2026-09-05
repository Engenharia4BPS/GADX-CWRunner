import assert from "node:assert/strict";
import test from "node:test";
import { BANDMAP_40M, BandmapEngine, createSeededRandom, VirtualVfo } from "../src/bandmap.ts";
import { planBandActivity } from "../src/band-activity.ts";
import { startSandpWorld } from "../src/sandp-world.ts";

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

test("Bandmap real cria pares próximos sem perder espalhamento ou espaçamento", () => {
  const stations = new BandmapEngine(createSeededRandom(2026)).generate(callsigns, options);
  const paired = stations.filter((station, index) => stations.some((other, otherIndex) => index !== otherIndex && Math.abs(other.frequencyKhz - station.frequencyKhz) >= .35 && Math.abs(other.frequencyKhz - station.frequencyKhz) <= .7));
  assert.ok(paired.length >= 14);
  for (let index = 1; index < stations.length; index += 1) assert.ok(stations[index].frequencyKhz - stations[index - 1].frequencyKhz >= BANDMAP_40M.minimumSpacingKhz);
  assert.ok(stations.at(-1).frequencyKhz - stations[0].frequencyKhz > 30);
});

test("atividade encontra vizinha no Bandmap realmente gerado sem aplicar RF duas vezes", () => {
  const stations = new BandmapEngine(createSeededRandom(2027)).generate(callsigns, options);
  const world = startSandpWorld(stations, "PY5XT", 0, createSeededRandom(99));
  const active = world.stations[0];
  const ready = { ...world, activeStationId: active.id, stations: world.stations.map((station) => ({ ...station, activity: "calling-cq" })) };
  const emission = planBandActivity(ready, active.sourceFrequencyKhz, 0, () => 0);
  assert.ok(emission);
  assert.notEqual(emission.stationId, active.id);
  assert.ok(emission.gainMultiplier > 0);
  assert.ok(emission.gainMultiplier === 1 || emission.gainMultiplier === .16);
});

test("Bandmap agrupado respeita minimumSpacingKhz de 0.60", () => {
  const clusteredOptions = { ...options, minimumSpacingKhz: .6 };
  const first = new BandmapEngine(createSeededRandom(2028)).generate(callsigns, clusteredOptions);
  const second = new BandmapEngine(createSeededRandom(2028)).generate(callsigns, clusteredOptions);
  assert.deepEqual(first, second);
  for (let index = 1; index < first.length; index += 1) {
    assert.ok(first[index].frequencyKhz - first[index - 1].frequencyKhz >= .6);
  }
  const paired = first.filter((station, index) => first.some((other, otherIndex) => (
    index !== otherIndex
    && Math.abs(other.frequencyKhz - station.frequencyKhz) >= .6
    && Math.abs(other.frequencyKhz - station.frequencyKhz) <= .7
  )));
  assert.ok(paired.length >= 14);
});

test("Bandmap sem clusters respeita minimumSpacingKhz acima de 0.70", () => {
  const unclusteredOptions = { ...options, minimumSpacingKhz: .71 };
  const first = new BandmapEngine(createSeededRandom(2029)).generate(callsigns, unclusteredOptions);
  const second = new BandmapEngine(createSeededRandom(2029)).generate(callsigns, unclusteredOptions);
  assert.deepEqual(first, second);
  for (let index = 1; index < first.length; index += 1) {
    assert.ok(first[index].frequencyKhz - first[index - 1].frequencyKhz >= .71);
  }
  assert.ok(first.every((station, index) => first.every((other, otherIndex) => (
    index === otherIndex || Math.abs(other.frequencyKhz - station.frequencyKhz) > .7
  ))));
  assert.ok(first.every(({ frequencyKhz }) => frequencyKhz >= BANDMAP_40M.lowerKhz && frequencyKhz <= BANDMAP_40M.upperKhz));
});

test("Bandmap falha claramente quando o espaÃ§amento nÃ£o cabe na faixa", () => {
  assert.throws(
    () => new BandmapEngine(createSeededRandom(2030)).generate(callsigns, { ...options, minimumSpacingKhz: 3 }),
    (error) => error instanceof RangeError && /cannot fit/i.test(error.message),
  );
});

test("Bandmap uniforme usa a folga real quando o espaçamento cabe por pouco", () => {
  const tightOptions = { ...options, stationCount: 3, minimumSpacingKhz: 19.9 };
  const first = new BandmapEngine(createSeededRandom(2031)).generate(callsigns, tightOptions);
  const second = new BandmapEngine(createSeededRandom(2031)).generate(callsigns, tightOptions);
  assert.deepEqual(first, second);
  assert.equal(first.length, 3);
  assert.ok(first.every(({ frequencyKhz }) => frequencyKhz >= BANDMAP_40M.lowerKhz && frequencyKhz <= BANDMAP_40M.upperKhz));
  assert.ok(first[1].frequencyKhz - first[0].frequencyKhz >= 19.9);
  assert.ok(first[2].frequencyKhz - first[1].frequencyKhz >= 19.9);
});
