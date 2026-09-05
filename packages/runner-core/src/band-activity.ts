import type { SandpWorld, SandpWorldStation } from "./sandp-world.js";

export interface BandActivityEmission { stationId: string; text: string; sourceFrequencyKhz: number; offsetKhz: number; gainMultiplier: number; }

const filterGain = (distanceKhz: number): number => distanceKhz <= .25 ? 1 : distanceKhz <= .75 ? .16 : 0;

/** Planeja uma única emissão curta e determinística; não produz áudio nem agenda timers. */
export function planBandActivity(world: SandpWorld, vfoFrequencyKhz: number, _nowMs: number, random: () => number): BandActivityEmission | undefined {
  const eligible = world.stations.filter((station) => station.id !== world.activeStationId && (station.activity === "calling-cq" || station.activity === "working-other") && filterGain(Math.abs(station.sourceFrequencyKhz - vfoFrequencyKhz)) > 0);
  if (!eligible.length) return undefined;
  const station = eligible[Math.min(eligible.length - 1, Math.floor(random() * eligible.length))]!;
  const offsetKhz = station.sourceFrequencyKhz - vfoFrequencyKhz;
  const text = station.activity === "calling-cq" ? `CQ TEST ${station.callsign} ${station.callsign}` : random() < .5 ? `TU ${station.callsign}` : `QSL TU ${station.callsign}`;
  return { stationId: station.id, text, sourceFrequencyKhz: station.sourceFrequencyKhz, offsetKhz, gainMultiplier: Number((filterGain(Math.abs(offsetKhz)) * station.rfProfile.signalGain).toFixed(3)) };
}

export function activityStation(world: SandpWorld, emission: BandActivityEmission): SandpWorldStation | undefined { return world.stations.find((station) => station.id === emission.stationId); }
