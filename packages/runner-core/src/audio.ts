export type StationCount = 1 | 2 | 3;

export interface AdvancedAudioSettings {
  enabled: boolean;
  qrnLevel: number;
  qrmLevel: number;
  signalVariation: boolean;
  frequencyVariation: boolean;
  slowFading: boolean;
  stationSpeedVariation: boolean;
  stationCount: StationCount;
}

export interface StationSignalPlan {
  id: number;
  text: string;
  wpm: number;
  toneHz: number;
  gain: number;
  startDelaySeconds: number;
  frequencyDriftHz: number;
  fadingDepth: number;
}

export interface AudioScenePlan {
  stations: StationSignalPlan[];
  qrnLevel: number;
  qrmLevel: number;
  mixHeadroom: number;
}

const clampUnit = (value: number): number => Math.min(1, Math.max(0, value));

export function clampStationCount(value: number): StationCount {
  return Math.min(3, Math.max(1, Math.round(value))) as StationCount;
}

export function createAudioScene(
  texts: readonly string[],
  baseWpm: number,
  baseToneHz: number,
  settings: AdvancedAudioSettings,
  random: () => number = Math.random,
): AudioScenePlan {
  const count = settings.enabled ? clampStationCount(Math.min(settings.stationCount, texts.length)) : 1;
  const stations = texts.slice(0, count).map((text, index): StationSignalPlan => {
    const speedOffset = settings.enabled && settings.stationSpeedVariation ? Math.round((random() * 6) - 3) : 0;
    const toneOffset = settings.enabled && settings.frequencyVariation ? (random() * 50) - 25 : 0;
    const levelVariation = settings.enabled && settings.signalVariation ? 0.68 + (random() * 0.32) : 1;
    return {
      id: index,
      text,
      wpm: Math.min(60, Math.max(10, baseWpm + speedOffset)),
      toneHz: Math.min(1000, Math.max(300, baseToneHz + toneOffset)),
      gain: levelVariation * (index === 0 ? 1 : 0.72),
      startDelaySeconds: index === 0 ? 0 : random() * 0.14,
      frequencyDriftHz: settings.enabled && settings.frequencyVariation ? 3 + (random() * 7) : 0,
      fadingDepth: settings.enabled && settings.slowFading ? 0.18 + (random() * 0.32) : 0,
    };
  });
  const load = stations.length;
  return {
    stations,
    qrnLevel: settings.enabled ? clampUnit(settings.qrnLevel) : 0,
    qrmLevel: settings.enabled ? clampUnit(settings.qrmLevel) : 0,
    mixHeadroom: Math.min(0.82, 0.82 / Math.sqrt(Math.max(1, load))),
  };
}
