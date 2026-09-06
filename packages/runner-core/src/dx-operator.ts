import { resolveCallCopy, type CallCopyPolicy } from "./callsign-copy.js";

export type DxOperatorLogicalState =
  | "need-qso"
  | "need-number"
  | "need-call"
  | "need-end"
  | "done"
  | "failed";

export interface DxOperatorProfile {
  patience: number;
  wpm: number;
  responseDelayMs: number;
  replyTimeoutMs: number;
  callCopyPolicy: CallCopyPolicy;
  repeatsExchangeOnTimeout: boolean;
}

export interface DxOperatorState {
  logical: DxOperatorLogicalState;
  patience: number;
  callAttempts: number;
  lastHeardOperatorCall?: string;
}

export type DxOperatorDecision =
  | { type: "send-exchange"; text: string }
  | { type: "request-call"; text: "CALL?" | "AGN?" }
  | { type: "request-number"; text: "NR?" }
  | { type: "acknowledge"; text: string }
  | { type: "wait" }
  | { type: "failed" };

export type DxOperatorEvent =
  | { type: "operator-call"; expectedOperatorCall: string; heardOperatorCall: string; exchangeText: string }
  | { type: "reply-timeout"; exchangeText: string }
  | { type: "operator-exchange"; acknowledgementText: string }
  | { type: "station-finalized" };

export interface DxOperatorTransition {
  state: DxOperatorState;
  decision: DxOperatorDecision;
}

export function createDxOperatorState(profile: DxOperatorProfile): DxOperatorState {
  return {
    logical: "need-qso",
    patience: profile.patience,
    callAttempts: 0,
  };
}

const failed = (state: DxOperatorState): DxOperatorTransition => ({
  state: { ...state, logical: "failed" },
  decision: { type: "failed" },
});

/** Pure DX decision point: semantic input in, radio-neutral decision out. */
export function reduceDxOperator(
  state: DxOperatorState,
  profile: DxOperatorProfile,
  event: DxOperatorEvent,
): DxOperatorTransition {
  if (state.logical === "failed" || state.logical === "done") return { state, decision: { type: "wait" } };

  if (event.type === "operator-call") {
    const copy = resolveCallCopy(event.expectedOperatorCall, event.heardOperatorCall, profile.callCopyPolicy);
    const acceptsAlmost = profile.callCopyPolicy.acceptAlmost || profile.callCopyPolicy.skill === 1;
    const heard = {
      ...state,
      callAttempts: state.callAttempts + 1,
      lastHeardOperatorCall: event.heardOperatorCall,
    };
    if (copy.kind === "exact" || (copy.kind === "almost" && acceptsAlmost)) {
      return {
        state: { ...heard, logical: "need-number" },
        decision: { type: "send-exchange", text: event.exchangeText },
      };
    }
    const retry = { ...heard, patience: heard.patience - 1, logical: "need-call" as const };
    return retry.patience > 0
      ? { state: retry, decision: { type: "request-call", text: "CALL?" } }
      : failed(retry);
  }

  if (event.type === "operator-exchange") {
    if (state.logical !== "need-number") return { state, decision: { type: "wait" } };
    return {
      state: { ...state, logical: "need-end" },
      decision: { type: "acknowledge", text: event.acknowledgementText },
    };
  }

  if (event.type === "station-finalized") {
    return state.logical === "need-end"
      ? { state: { ...state, logical: "done" }, decision: { type: "wait" } }
      : { state, decision: { type: "wait" } };
  }

  const timedOut = { ...state, patience: state.patience - 1 };
  if (timedOut.patience <= 0) return failed(timedOut);
  if (state.logical === "need-number") {
    return profile.repeatsExchangeOnTimeout
      ? { state: { ...timedOut, logical: "need-number" }, decision: { type: "send-exchange", text: event.exchangeText } }
      : { state: { ...timedOut, logical: "need-number" }, decision: { type: "request-number", text: "NR?" } };
  }
  if (state.logical === "need-call" || state.logical === "need-qso") {
    return { state: { ...timedOut, logical: "need-call" }, decision: { type: "request-call", text: "CALL?" } };
  }
  return { state, decision: { type: "wait" } };
}
