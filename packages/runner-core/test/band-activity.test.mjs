import assert from "node:assert/strict";
import test from "node:test";
import { planBandActivity } from "../src/band-activity.ts";

const station = (id, activity, frequencyKhz) => ({ id, callsign: id.toUpperCase(), sourceFrequencyKhz: frequencyKhz, activity, rfProfile: { signalGain: .6 }, scenario: {} });
const world = (stations, activeStationId) => ({ stations, activeStationId, autonomousQsyCount: 0 });

test("planejador seleciona somente estação elegível e exclui a ativa", () => {
  const result = planBandActivity(world([station("active", "calling-cq", 7025), station("cq", "calling-cq", 7025.2), station("worked", "worked", 7025.1), station("pause", "cooldown", 7025.1)], "active"), 7025, 0, () => 0);
  assert.equal(result?.stationId, "cq");
  assert.match(result?.text ?? "", /^CQ TEST CQ CQ$/);
});

test("filtro VFO aplica ganho próximo, vazamento e silêncio fora", () => {
  const near = planBandActivity(world([station("near", "working-other", 7025.25)]), 7025, 0, () => .1);
  const leak = planBandActivity(world([station("leak", "working-other", 7025.75)]), 7025, 0, () => .1);
  const out = planBandActivity(world([station("out", "calling-cq", 7025.76)]), 7025, 0, () => .1);
  assert.equal(near?.gainMultiplier, 1);
  assert.equal(leak?.gainMultiplier, .16);
  assert.equal(out, undefined);
  assert.match(near?.text ?? "", /^(TU|QSL TU) NEAR$/);
});

test("mesma sequência gera a mesma emissão sem alterar o perfil RF", () => {
  const source = world([station("one", "calling-cq", 7025.1), station("two", "working-other", 7025.2)]);
  const first = planBandActivity(source, 7025, 10, () => .8);
  const second = planBandActivity(source, 7025, 10, () => .8);
  assert.deepEqual(first, second);
  assert.equal(source.stations[1].rfProfile.signalGain, .6);
});
