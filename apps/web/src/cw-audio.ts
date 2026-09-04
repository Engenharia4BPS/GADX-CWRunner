import { createAudioScene, ditDurationSeconds, encodeMorse, type AdvancedAudioSettings, type AudioScenePlan, type RxEnvironmentSettings, type StationSignalPlan } from "@gadx/runner-core";
import { RxEnvironment } from "./rx-environment";

export interface SceneOptions {
  wpm: number;
  toneHz: number;
  volume: number;
  signalGain?: number;
  advanced: AdvancedAudioSettings;
}

export class CwAudioEngine {
  private readonly master: GainNode;
  private readonly limiter: DynamicsCompressorNode;
  private readonly cwBus: GainNode;
  private readonly environment: RxEnvironment;
  private readonly sources = new Set<AudioScheduledSourceNode>();

  constructor(private readonly context: AudioContext, random: () => number = Math.random) {
    this.master = context.createGain();
    this.limiter = context.createDynamicsCompressor();
    this.cwBus = context.createGain();
    this.limiter.threshold.value = -8;
    this.limiter.knee.value = 4;
    this.limiter.ratio.value = 16;
    this.limiter.attack.value = 0.003;
    this.limiter.release.value = 0.12;
    this.cwBus.connect(this.master);
    this.master.connect(this.limiter).connect(context.destination);
    this.environment = new RxEnvironment(context, this.master, random);
  }

  setVolume(value: number): void {
    const normalized = Math.min(1, Math.max(0, value));
    this.master.gain.setValueAtTime(normalized ** 2, this.context.currentTime);
  }

  stop(): void {
    for (const source of this.sources) {
      try { source.stop(); } catch { /* A fonte já terminou. */ }
    }
    this.sources.clear();
  }

  stopAll(): void {
    this.stop();
    this.environment.stop(true);
  }

  startEnvironment(settings: RxEnvironmentSettings, toneHz: number): void {
    this.environment.start(settings, toneHz);
  }

  updateEnvironment(settings: RxEnvironmentSettings, toneHz: number): void {
    this.environment.update(settings, toneHz);
  }

  stopEnvironment(): void {
    this.environment.stop(false);
  }

  setQrmCallsigns(callsigns: readonly string[], excluded: readonly string[]): void {
    this.environment.setQrmCallsigns(callsigns, excluded);
  }

  get environmentActive(): boolean { return this.environment.active; }

  playTestTone(toneHz: number, volume: number): void {
    this.stop();
    this.setVolume(volume);
    const start = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    oscillator.frequency.setValueAtTime(toneHz, start);
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(1, start + 0.01);
    envelope.gain.setValueAtTime(1, start + 0.35);
    envelope.gain.linearRampToValueAtTime(0, start + 0.4);
    oscillator.connect(envelope).connect(this.master);
    this.track(oscillator);
    oscillator.start(start);
    oscillator.stop(start + 0.41);
  }

  play(texts: readonly string[], options: SceneOptions): number {
    this.stop();
    this.setVolume(options.volume);
    const scene = createAudioScene(texts, options.wpm, options.toneHz, options.advanced);
    const start = this.context.currentTime + 0.03;
    let end = start;
    const signalGain = Math.min(1, Math.max(0.12, options.signalGain ?? 1));
    for (const station of scene.stations) end = Math.max(end, this.scheduleStation({ ...station, gain: station.gain * signalGain }, scene, start));
    return Math.max(0, (end - this.context.currentTime) * 1000);
  }

  private scheduleStation(station: StationSignalPlan, scene: AudioScenePlan, sceneStart: number): number {
    const bus = this.context.createGain();
    const baseGain = station.gain * scene.mixHeadroom;
    const start = sceneStart + station.startDelaySeconds;
    let cursor = start;
    const dit = ditDurationSeconds(station.wpm);
    bus.gain.setValueAtTime(baseGain, start);
    bus.connect(this.cwBus);
    for (const item of encodeMorse(station.text)) {
      const duration = item.dits * dit;
      if (item.type === "tone") {
        const oscillator = this.context.createOscillator();
        const envelope = this.context.createGain();
        const edge = Math.min(0.005, duration / 4);
        oscillator.frequency.setValueAtTime(station.toneHz - (station.frequencyDriftHz / 2), cursor);
        if (station.frequencyDriftHz > 0) oscillator.frequency.linearRampToValueAtTime(station.toneHz + (station.frequencyDriftHz / 2), cursor + duration);
        envelope.gain.setValueAtTime(0, cursor);
        envelope.gain.linearRampToValueAtTime(1, cursor + edge);
        envelope.gain.setValueAtTime(1, cursor + duration - edge);
        envelope.gain.linearRampToValueAtTime(0, cursor + duration);
        oscillator.connect(envelope).connect(bus);
        this.track(oscillator);
        oscillator.start(cursor);
        oscillator.stop(cursor + duration);
      }
      cursor += duration;
    }
    if (station.fadingDepth > 0) {
      let fadingCursor = start;
      let low = false;
      while (fadingCursor < cursor) {
        bus.gain.linearRampToValueAtTime(baseGain * (low ? 1 : 1 - station.fadingDepth), Math.min(cursor, fadingCursor + 0.65));
        low = !low;
        fadingCursor += 0.65;
      }
    }
    return cursor;
  }

  private track<T extends AudioScheduledSourceNode>(source: T): T {
    this.sources.add(source);
    source.addEventListener("ended", () => this.sources.delete(source), { once: true });
    return source;
  }
}
