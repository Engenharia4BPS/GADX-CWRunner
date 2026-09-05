import type { BandmapStation } from "./bandmap.js";
import { createSpQsoScenario, type SpQsoScenario, type SpStationProfile } from "./sp-qso.js";

export type DxStationActivity = "calling-cq" | "working-other" | "cooldown" | "worked" | "qsy";
export interface SandpWorldStation {
  id: string;
  callsign: string;
  profile: SpStationProfile;
  skill: 1 | 2 | 3;
  wpm: number;
  patience: number;
  responseDelayMs: number;
  toneOffsetHz: number;
  signalLevel: number;
  activity: DxStationActivity;
  nextTransitionAtMs?: number;
  scenario: SpQsoScenario;
}
export interface SandpWorld { stations: readonly SandpWorldStation[]; selectedStationId?: string; activeStationId?: string; }

const busyFor = (random: () => number): number => 18_000 + Math.round(random() * 22_000);
const cooldownFor = (random: () => number): number => 7_000 + Math.round(random() * 10_000);
const copy = (world: SandpWorld, stations: readonly SandpWorldStation[], changes: Partial<SandpWorld> = {}): SandpWorld => ({ ...world, ...changes, stations });

/** Cria identidades persistentes para os spots; toda aleatoriedade vem do chamador. */
export function startSandpWorld(spots: readonly BandmapStation[], operatorCall: string, nowMs: number, random: () => number): SandpWorld {
  return {
    stations: spots.map((spot, index) => {
      const scenario = createSpQsoScenario(spot.callsign, operatorCall, String(100 + Math.floor(random() * 900)), random, {
        id: spot.id, wpm: spot.wpm, toneOffsetHz: spot.toneHz, signalLevel: spot.signalDb,
      });
      const working = random() < 0.2;
      return { id: spot.id, callsign: spot.callsign, profile: scenario.profile, skill: scenario.skill, wpm: scenario.wpm, patience: scenario.patience, responseDelayMs: scenario.responseDelayMs, toneOffsetHz: scenario.toneOffsetHz, signalLevel: scenario.signalLevel, activity: working ? "working-other" : "calling-cq", ...(working ? { nextTransitionAtMs: nowMs + busyFor(random) } : {}), scenario };
    }),
  };
}

export function sandpWorldStation(world: SandpWorld | undefined, id: string): SandpWorldStation | undefined { return world?.stations.find((station) => station.id === id); }
export function selectSandpStation(world: SandpWorld, stationId: string, _nowMs: number): SandpWorld {
  const station = sandpWorldStation(world, stationId);
  if (!station || station.activity === "worked" || station.activity === "qsy") return world;
  return { ...world, selectedStationId: stationId };
}
export function setSandpQsoActive(world: SandpWorld, stationId: string | undefined): SandpWorld { return { ...world, activeStationId: stationId }; }
export function advanceSandpWorld(world: SandpWorld, nowMs: number, random: () => number): SandpWorld {
  let changed = false;
  const stations = world.stations.map((station) => {
    if (station.id === world.activeStationId || station.activity === "worked" || station.activity === "qsy" || !station.nextTransitionAtMs || nowMs < station.nextTransitionAtMs) return station;
    changed = true;
    if (station.activity === "working-other") return { ...station, activity: "calling-cq" as const, nextTransitionAtMs: undefined };
    if (station.activity === "cooldown") return { ...station, activity: random() < 0.15 ? "working-other" as const : "calling-cq" as const, nextTransitionAtMs: random() < 0.15 ? nowMs + busyFor(random) : undefined };
    return station;
  });
  return changed ? copy(world, stations) : world;
}
export function markSandpStationWorked(world: SandpWorld, stationId: string, _nowMs: number): SandpWorld { return copy(world, world.stations.map((station) => station.id === stationId ? { ...station, activity: "worked" as const, nextTransitionAtMs: undefined } : station), { activeStationId: undefined }); }
/** A estação ocupada continua no mundo, mas não pode iniciar outro QSO até o prazo expirar. */
export function markSandpStationBusy(world: SandpWorld, stationId: string, nowMs: number, random: () => number): SandpWorld {
  const station = sandpWorldStation(world, stationId);
  if (!station || station.activity === "worked" || station.activity === "qsy") return world;
  return copy(world, world.stations.map((candidate) => candidate.id === stationId ? { ...candidate, activity: "working-other" as const, nextTransitionAtMs: nowMs + busyFor(random) } : candidate), { activeStationId: world.activeStationId === stationId ? undefined : world.activeStationId });
}
export function markSandpStationFailed(world: SandpWorld, stationId: string, nowMs: number, random: () => number): SandpWorld { return copy(world, world.stations.map((station) => station.id === stationId && station.activity !== "worked" && station.activity !== "qsy" ? { ...station, activity: "cooldown" as const, nextTransitionAtMs: nowMs + cooldownFor(random) } : station), { activeStationId: undefined }); }
export function markSandpStationQsy(world: SandpWorld, stationId: string): SandpWorld { return copy(world, world.stations.map((station) => station.id === stationId ? { ...station, activity: "qsy" as const, nextTransitionAtMs: undefined } : station), { activeStationId: undefined }); }
