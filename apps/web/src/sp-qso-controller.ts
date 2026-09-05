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
    if (key === "F2" || key === "F4" || key === "F6" || key === "F8" || key === "F9" || key === "F10") this.cancelReplyTimeout();
    const events: Record<"F2" | "F3" | "F4" | "F6" | "F8" | "F9" | "F10", SpQsoEvent> = {
      F2: { type: "operator-transmitted", text: `5NN ${this.state.serial}`, intent: { kind: "send-exchange" } },
      F3: { type: "operator-transmitted", text: "TU" },
      F4: { type: "operator-transmitted", text: this.state.scenario?.operatorCall ?? "", intent: { kind: "call-station" } },
      F6: { type: "operator-transmitted", text: this.state.lastOperatorText ?? "", intent: { kind: "request-again" } },
      F8: { type: "operator-transmitted", text: "AGN?", intent: { kind: "request-again" } },
      F9: { type: "operator-transmitted", text: "NR?", intent: { kind: "request-number" } },
      F10: { type: "operator-transmitted", text: "CALL?", intent: { kind: "request-call" } },
    };
    this.dispatch(events[key]);
  }

  submit(call: string, rst: string, exchange: string): void {
    this.entry = { call, rst, exchange };
    this.dispatch({ type: "operator-exchange", call, rst, exchange });
  }

  enter(call: string, rst: string, exchange: string): void {
    this.entry = { call, rst, exchange };
    const phase = this.state.phase;
    if (phase === "listening-cq" || phase === "station-requesting-call") this.dispatch({ type: "operator-call", text: this.state.scenario?.operatorCall ?? "" });
    else if (phase === "station-requesting-number") this.dispatch({ type: "operator-send-exchange" });
    else if (phase === "station-requesting-again") this.dispatch({ type: "operator-repeat" });
    else if (phase === "receiving-exchange" && (!call.trim() || call.includes("?"))) this.dispatch({ type: "operator-call-request" });
    else if (phase === "receiving-exchange" && !exchange.trim()) this.dispatch({ type: "operator-number-request" });
    else if (phase === "receiving-exchange") this.dispatch({ type: "operator-exchange", call, rst, exchange });
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
    if (effect.type === "update-spot-status") return;
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
