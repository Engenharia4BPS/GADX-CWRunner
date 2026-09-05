import { checkSpQso, INITIAL_SP_QSO_STATE, reduceSpQso, type QsoCheck, type SpQsoEffect, type SpQsoEvent, type SpQsoScenario, type SpQsoState, type SpStationMessage } from "@gadx/runner-core";

export interface SpQsoControllerPorts {
  playOperator(text: string): number;
  playStation(text: string, wpm: number): number;
  stopCw(): void;
  schedule(action: () => void, delayMs: number): number;
  cancelSchedule(handle: number): void;
  status(label: string): void;
  clearEntry(): void;
  registerQso(result: QsoCheck): void;
  recordError(): void;
  markWorked(): void;
  updateSpotStatus(status: "BUSY" | "WORKED" | "FAILED" | "QSY"): void;
  restartCq(): void;
}

export class SpQsoController {
  private state: SpQsoState = INITIAL_SP_QSO_STATE;
  private generation = 0;
  private readonly timers = new Set<number>();
  private replyTimeout?: number;
  private readonly ports: SpQsoControllerPorts;
  private entry = { call: "", rst: "", exchange: "" };

  constructor(ports: SpQsoControllerPorts) {
    this.ports = ports;
  }

  get currentState(): SpQsoState { return this.state; }

  begin(scenario: SpQsoScenario, serial: string): void {
    this.cancel(false);
    this.dispatch({ type: "start", scenario, serial });
  }

  macro(key: "F2" | "F3" | "F4" | "F6" | "F8" | "F9" | "F10", entry = { call: "", rst: "", exchange: "" }): void {
    this.entry = { ...entry };
    const texts: Record<"F2" | "F3" | "F4" | "F6" | "F8" | "F9" | "F10", string> = {
      F2: `5NN ${this.state.serial}`, F3: "TU", F4: this.state.scenario?.operatorCall ?? "", F6: this.state.lastOperatorText ?? "", F8: "AGN?", F9: "NR?", F10: "CALL?",
    };
    this.transmitText(texts[key]);
  }

  transmitText(text: string): void {
    const normalized = text.trim().toUpperCase().replace(/\s+/g, " ");
    if (!normalized) return;
    this.cancelReplyTimeout();
    this.dispatch({ type: "operator-transmitted", text: normalized });
  }

  submit(call: string, rst: string, exchange: string): void {
    this.enter(call, rst, exchange);
  }

  enter(call: string, rst: string, exchange: string): void {
    this.entry = { call, rst, exchange };
    const phase = this.state.phase;
    if (phase === "listening-cq" || phase === "station-requesting-call") this.transmitText(this.state.scenario?.operatorCall ?? "");
    else if (phase === "station-requesting-number") this.transmitText(`5NN ${this.state.serial}`);
    else if (phase === "station-requesting-again") this.transmitText(this.state.lastOperatorText ?? "");
    else if (phase === "receiving-exchange" && (!call.trim() || call.includes("?"))) this.transmitText("CALL?");
    else if (phase === "receiving-exchange" && !exchange.trim()) this.transmitText("NR?");
    else if (phase === "receiving-exchange") this.transmitText(`5NN ${this.state.serial}`);
  }

  clear(): void {
    const scenario = this.state.scenario;
    if (!scenario) return;
    const serial = this.state.serial;
    this.cancel(false);
    this.dispatch({ type: "start", scenario, serial });
    this.ports.restartCq();
  }

  abort(): void {
    this.dispatch({ type: "abort" });
    this.cancel(true);
  }

  private dispatch(event: SpQsoEvent): void {
    const transition = reduceSpQso(this.state, event);
    this.state = transition.state;
    transition.effects.forEach((effect) => this.execute(effect));
  }

  private execute(effect: SpQsoEffect): void {
    if (effect.type === "status") { this.ports.status(effect.label); return; }
    if (effect.type === "clear-entry") { this.ports.clearEntry(); return; }
    if (effect.type === "register-qso") { const scenario = this.state.scenario; this.ports.registerQso(scenario ? checkSpQso(this.entry, scenario) : effect.result); return; }
    if (effect.type === "record-error") { this.ports.recordError(); return; }
    if (effect.type === "mark-worked") { this.ports.markWorked(); return; }
    if (effect.type === "restart-cq") { this.ports.restartCq(); return; }
    if (effect.type === "update-spot-status") { this.ports.updateSpotStatus(effect.status); return; }
    if (effect.type === "cancel-reply-timeout") { this.cancelReplyTimeout(); return; }
    if (effect.type === "start-reply-timeout") { this.cancelReplyTimeout(); const generation = this.generation; let timer = 0; timer = this.ports.schedule(() => { this.timers.delete(timer); if (this.replyTimeout === timer) this.replyTimeout = undefined; if (generation === this.generation) this.dispatch({ type: "reply-timeout" }); }, effect.delayMs); this.replyTimeout = timer; this.timers.add(timer); return; }
    if (effect.type === "play-operator") {
      const duration = this.ports.playOperator(effect.text);
      this.defer(() => this.dispatch({ type: "operator-finished" }), duration + 80);
      return;
    }
    const playStation = (): void => {
      const duration = this.ports.playStation(effect.text, this.state.scenario?.wpm ?? 30);
      this.defer(() => this.dispatch({ type: "station-finished", message: effect.message as SpStationMessage }), duration + 80);
    };
    if (effect.delayMs && effect.delayMs > 0) this.defer(playStation, effect.delayMs);
    else playStation();
  }

  private defer(action: () => void, delayMs: number): void {
    const generation = this.generation;
    let timer = 0;
    timer = this.ports.schedule(() => {
      this.timers.delete(timer);
      if (generation === this.generation) action();
    }, delayMs);
    this.timers.add(timer);
  }

  private cancel(stopAudio: boolean): void {
    this.generation += 1;
    this.replyTimeout = undefined;
    this.timers.forEach((timer) => this.ports.cancelSchedule(timer));
    this.timers.clear();
    if (stopAudio) this.ports.stopCw();
  }

  private cancelReplyTimeout(): void {
    if (this.replyTimeout === undefined) return;
    this.ports.cancelSchedule(this.replyTimeout);
    this.timers.delete(this.replyTimeout);
    this.replyTimeout = undefined;
  }
}
