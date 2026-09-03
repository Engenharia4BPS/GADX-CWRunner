export interface SequencedClientEvent {
  sessionId: string;
  sequence: number;
  clientMonotonicMs: number;
}

export interface EnteredTextEvent extends SequencedClientEvent {
  type: "entered-text";
  value: string;
}

export interface LogQsoEvent extends SequencedClientEvent {
  type: "log-qso";
  callsign: string;
}

export type ClientEvent = EnteredTextEvent | LogQsoEvent;
