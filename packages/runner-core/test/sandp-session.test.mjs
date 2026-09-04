import assert from "node:assert/strict";
import test from "node:test";
import { BandmapEngine, createSeededRandom, VirtualVfo } from "../src/bandmap.ts";
import { SandPSessionController } from "../src/sandp-session.ts";

function scenario() {
  const engine = new BandmapEngine(createSeededRandom(11));
  const stations = engine.generate(Array.from({ length: 15 }, (_, index) => `K${index}ABC`), { baseWpm: 28, baseToneHz: 600, spottedAt: 1_800_000_000_000 });
  const vfo = new VirtualVfo();
  const events = { plays: [], stopped: 0, scheduled: [], cancelled: [], selections: [] };
  let handle = 0;
  const controller = new SandPSessionController(engine, vfo, {
    stopCw: () => { events.stopped += 1; },
    playCq: (station) => { events.plays.push(station.callsign); return 900; },
    schedule: (_action, delay) => { const id = ++handle; events.scheduled.push({ id, delay }); return id; },
    cancelSchedule: (id) => { events.cancelled.push(id); },
    onSelection: (station) => { events.selections.push(station.callsign); },
  }, createSeededRandom(4));
  return { controller, engine, stations, vfo, events };
}

test("trocar estação cancela o CQ anterior e atualiza o VFO", () => {
  const { controller, stations, vfo, events } = scenario();
  controller.start();
  controller.tune(stations[0].id);
  const firstHandle = events.scheduled.at(-1).id;
  controller.tune(stations[1].id);
  assert.ok(events.cancelled.includes(firstHandle));
  assert.deepEqual(events.plays, [stations[0].callsign, stations[1].callsign]);
  assert.equal(vfo.frequencyKhz, stations[1].frequencyKhz);
});

test("F6 repete imediatamente a estação atual", () => {
  const { controller, stations, events } = scenario();
  controller.start();
  controller.tune(stations[2].id);
  assert.equal(controller.repeat(), true);
  assert.deepEqual(events.plays, [stations[2].callsign, stations[2].callsign]);
  assert.ok(events.cancelled.length >= 1);
});

test("parada equivalente ao Esc cancela timers, áudio e seleção", () => {
  const { controller, stations, engine, events } = scenario();
  controller.start();
  controller.tune(stations[3].id);
  const timer = events.scheduled.at(-1).id;
  controller.stop();
  assert.equal(controller.running, false);
  assert.equal(engine.selectedStation, undefined);
  assert.ok(events.cancelled.includes(timer));
  assert.ok(events.stopped >= 2);
});
