import {
  createQrmEvent,
  createQrnEvent,
  ditDurationSeconds,
  encodeMorse,
  RxEnvironmentLifecycle,
  type QrmSignalPlan,
  type RxEnvironmentSettings,
} from "@gadx/runner-core";

const FADE_SECONDS = 0.15;

export class RxEnvironment {
  private readonly lifecycle = new RxEnvironmentLifecycle();
  private readonly qrnSources = new Set<AudioScheduledSourceNode>();
  private readonly qrmSources = new Set<AudioScheduledSourceNode>();
  private settings?: RxEnvironmentSettings;
  private ambientBus?: GainNode;
  private bandGain?: GainNode;
  private bandHighpass?: BiquadFilterNode;
  private bandLowpass?: BiquadFilterNode;
  private bandPeak?: BiquadFilterNode;
  private bandSource?: AudioBufferSourceNode;
  private noiseBuffer?: AudioBuffer;
  private qrnBus?: GainNode;
  private qrmBus?: GainNode;
  private qrnTimer?: number;
  private qrmTimer?: number;
  private cleanupTimer?: number;
  private toneHz = 600;
  private qrmCallsigns: readonly string[] = [];
  private excludedQrmCallsigns: readonly string[] = [];

  constructor(
    private readonly context: AudioContext,
    private readonly destination: AudioNode,
    private readonly random: () => number = Math.random,
  ) {}

  get active(): boolean { return this.lifecycle.active; }

  setQrmCallsigns(callsigns: readonly string[], excluded: readonly string[]): void {
    this.qrmCallsigns = callsigns;
    this.excludedQrmCallsigns = excluded;
    if (!this.active || !this.settings || this.settings.qrmLevel <= 0) return;
    if (this.qrmTimer) window.clearTimeout(this.qrmTimer);
    this.qrmTimer = undefined;
    this.scheduleNextQrm();
  }

  start(settings: RxEnvironmentSettings, toneHz: number): void {
    this.settings = { ...settings };
    this.toneHz = toneHz;
    if (!settings.enabled) { this.stop(false); return; }
    if (!this.lifecycle.start(true)) { this.update(settings, toneHz); return; }
    if (this.cleanupTimer) { window.clearTimeout(this.cleanupTimer); this.cleanupTimer = undefined; this.finishStop(); }

    const now = this.context.currentTime;
    this.ambientBus = this.context.createGain();
    this.ambientBus.gain.setValueAtTime(0, now);
    this.ambientBus.gain.linearRampToValueAtTime(1, now + FADE_SECONDS);
    this.ambientBus.connect(this.destination);

    this.qrnBus = this.context.createGain();
    this.qrmBus = this.context.createGain();
    this.qrnBus.connect(this.ambientBus);
    this.qrmBus.connect(this.ambientBus);
    this.createBandNoise(now);
    this.applyLevels(now);
    this.scheduleNextQrn();
    this.scheduleNextQrm();
  }

  update(settings: RxEnvironmentSettings, toneHz: number): void {
    this.settings = { ...settings };
    this.toneHz = toneHz;
    if (!settings.enabled) { this.stop(false); return; }
    if (!this.active) return;
    this.applyLevels(this.context.currentTime);
    this.syncTimers();
  }

  stop(immediate = false): void {
    const wasActive = this.lifecycle.stop();
    if (!wasActive && !immediate) return;
    this.clearTimers();
    if (this.cleanupTimer) window.clearTimeout(this.cleanupTimer);
    this.cleanupTimer = undefined;
    if (immediate || !this.ambientBus) { this.finishStop(); return; }
    const now = this.context.currentTime;
    this.ambientBus.gain.cancelScheduledValues(now);
    this.ambientBus.gain.setValueAtTime(this.ambientBus.gain.value, now);
    this.ambientBus.gain.linearRampToValueAtTime(0, now + FADE_SECONDS);
    this.cleanupTimer = window.setTimeout(() => { this.cleanupTimer = undefined; this.finishStop(); }, (FADE_SECONDS * 1000) + 30);
  }

  private createBandNoise(now: number): void {
    if (!this.ambientBus) return;
    this.bandSource = this.context.createBufferSource();
    this.bandSource.buffer = this.getNoiseBuffer();
    this.bandSource.loop = true;
    this.bandHighpass = this.context.createBiquadFilter();
    this.bandHighpass.type = "highpass";
    this.bandHighpass.frequency.value = 120;
    this.bandLowpass = this.context.createBiquadFilter();
    this.bandLowpass.type = "lowpass";
    this.bandPeak = this.context.createBiquadFilter();
    this.bandPeak.type = "peaking";
    this.bandPeak.Q.value = 0.8;
    this.bandPeak.gain.value = 3;
    this.bandGain = this.context.createGain();
    this.bandGain.gain.value = 0;
    this.bandSource.connect(this.bandHighpass).connect(this.bandLowpass).connect(this.bandPeak).connect(this.bandGain).connect(this.ambientBus);
    this.bandSource.start(now);
  }

  private applyLevels(now: number): void {
    if (!this.settings || !this.bandGain || !this.bandLowpass || !this.bandPeak) return;
    const bandTarget = this.settings.bandNoiseLevel * 0.55;
    this.bandGain.gain.cancelScheduledValues(now);
    this.bandGain.gain.setValueAtTime(this.bandGain.gain.value, now);
    this.bandGain.gain.linearRampToValueAtTime(bandTarget, now + FADE_SECONDS);
    this.bandLowpass.frequency.setTargetAtTime(Math.min(2600, Math.max(1100, this.toneHz + 1100)), now, 0.05);
    this.bandPeak.frequency.setTargetAtTime(this.toneHz, now, 0.05);
  }

  private syncTimers(): void {
    if (!this.settings) return;
    if (this.settings.qrnLevel <= 0 && this.qrnTimer) { window.clearTimeout(this.qrnTimer); this.qrnTimer = undefined; }
    if (this.settings.qrmLevel <= 0 && this.qrmTimer) { window.clearTimeout(this.qrmTimer); this.qrmTimer = undefined; }
    if (this.settings.qrnLevel > 0 && !this.qrnTimer) this.scheduleNextQrn();
    if (this.settings.qrmLevel > 0 && !this.qrmTimer) this.scheduleNextQrm();
  }

  private scheduleNextQrn(): void {
    if (!this.active || !this.settings || this.settings.qrnLevel <= 0) return;
    const plan = createQrnEvent(this.settings.qrnLevel, this.random);
    this.qrnTimer = window.setTimeout(() => {
      this.qrnTimer = undefined;
      if (!this.active || !this.qrnBus) return;
      const start = this.context.currentTime + 0.01;
      for (let pulse = 0; pulse < plan.pulses; pulse += 1) this.emitQrnPulse(start + (pulse * plan.pulseSpacingSeconds), plan.durationSeconds, plan.intensity, plan.filterHz);
      this.scheduleNextQrn();
    }, plan.delaySeconds * 1000);
  }

  private emitQrnPulse(start: number, duration: number, intensity: number, filterHz: number): void {
    if (!this.qrnBus) return;
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const envelope = this.context.createGain();
    source.buffer = this.getNoiseBuffer();
    source.loop = true;
    filter.type = "bandpass";
    filter.frequency.value = filterHz;
    filter.Q.value = 0.45 + (this.random() * 1.8);
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(intensity, start + Math.min(0.012, duration / 4));
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter).connect(envelope).connect(this.qrnBus);
    this.track(source, this.qrnSources);
    source.start(start);
    source.stop(start + duration + 0.01);
  }

  private scheduleNextQrm(): void {
    if (!this.active || !this.settings || this.settings.qrmLevel <= 0) return;
    const plan = createQrmEvent(this.settings.qrmLevel, this.settings.stationCount, this.excludedQrmCallsigns, this.random, this.qrmCallsigns.length ? this.qrmCallsigns : undefined);
    this.qrmTimer = window.setTimeout(() => {
      this.qrmTimer = undefined;
      if (!this.active || !this.qrmBus) return;
      const start = this.context.currentTime + 0.02;
      for (const signal of plan.signals) this.emitQrmSignal(signal, start + signal.delaySeconds);
      this.scheduleNextQrm();
    }, plan.delaySeconds * 1000);
  }

  private emitQrmSignal(signal: QrmSignalPlan, start: number): void {
    if (!this.qrmBus) return;
    const frequency = Math.max(120, this.toneHz + signal.frequencyOffsetHz);
    if (signal.carrierDurationSeconds > 0) {
      this.emitCarrier(start, frequency, signal.gain, signal.carrierDurationSeconds);
      return;
    }
    const stationBus = this.context.createGain();
    stationBus.gain.value = signal.gain;
    stationBus.connect(this.qrmBus);
    const dit = ditDurationSeconds(signal.wpm);
    let cursor = start;
    for (const item of encodeMorse(signal.text)) {
      const duration = item.dits * dit;
      if (item.type === "tone") {
        const oscillator = this.context.createOscillator();
        const envelope = this.context.createGain();
        const edge = Math.min(0.008, duration / 4);
        oscillator.frequency.setValueAtTime(frequency - 3, cursor);
        oscillator.frequency.linearRampToValueAtTime(frequency + 3, cursor + duration);
        envelope.gain.setValueAtTime(0, cursor);
        envelope.gain.linearRampToValueAtTime(1, cursor + edge);
        envelope.gain.setValueAtTime(1, cursor + duration - edge);
        envelope.gain.linearRampToValueAtTime(0, cursor + duration);
        oscillator.connect(envelope).connect(stationBus);
        this.track(oscillator, this.qrmSources);
        oscillator.start(cursor);
        oscillator.stop(cursor + duration + 0.005);
      }
      cursor += duration;
    }
  }

  private emitCarrier(start: number, frequency: number, gainValue: number, duration: number): void {
    if (!this.qrmBus) return;
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    oscillator.frequency.value = frequency;
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(gainValue * 0.65, start + Math.min(0.08, duration / 3));
    envelope.gain.setValueAtTime(gainValue * 0.65, start + Math.max(0.08, duration - 0.08));
    envelope.gain.linearRampToValueAtTime(0, start + duration);
    oscillator.connect(envelope).connect(this.qrmBus);
    this.track(oscillator, this.qrmSources);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.005);
  }

  private getNoiseBuffer(): AudioBuffer {
    if (this.noiseBuffer) return this.noiseBuffer;
    const length = this.context.sampleRate * 2;
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    let previous = 0;
    for (let index = 0; index < length; index += 1) {
      const white = (this.random() * 2) - 1;
      previous = (previous * 0.32) + (white * 0.68);
      data[index] = previous;
    }
    this.noiseBuffer = buffer;
    return buffer;
  }

  private clearTimers(): void {
    if (this.qrnTimer) window.clearTimeout(this.qrnTimer);
    if (this.qrmTimer) window.clearTimeout(this.qrmTimer);
    this.qrnTimer = undefined;
    this.qrmTimer = undefined;
  }

  private finishStop(): void {
    this.clearTimers();
    this.stopSource(this.bandSource);
    this.bandSource = undefined;
    for (const source of this.qrnSources) this.stopSource(source);
    for (const source of this.qrmSources) this.stopSource(source);
    this.qrnSources.clear();
    this.qrmSources.clear();
    this.ambientBus?.disconnect();
    this.ambientBus = undefined;
    this.bandGain = undefined;
    this.bandHighpass = undefined;
    this.bandLowpass = undefined;
    this.bandPeak = undefined;
    this.qrnBus = undefined;
    this.qrmBus = undefined;
  }

  private stopSource(source: AudioScheduledSourceNode | undefined): void {
    if (!source) return;
    try { source.stop(); } catch { /* A fonte já terminou. */ }
  }

  private track<T extends AudioScheduledSourceNode>(source: T, collection: Set<AudioScheduledSourceNode>): T {
    collection.add(source);
    source.addEventListener("ended", () => collection.delete(source), { once: true });
    return source;
  }
}
