export interface ContestTransmissionContext { operatorCall: string; stationCall: string; operatorSerial: string; stationExchange?: string; phase?: "calling" | "exchange" | "closing"; }
export type OperatorIntent =
  | { kind: "call-station"; copiedCall?: string }
  | { kind: "send-exchange"; call?: string; rst?: string; serial?: string }
  | { kind: "send-call-and-exchange"; call?: string; rst?: string; serial?: string }
  | { kind: "request-again" } | { kind: "request-call" } | { kind: "request-number" } | { kind: "send-tu" } | { kind: "unknown" };

const normalize = (text: string): string[] => text.toUpperCase().replace(/[.,;:]/g, " ").trim().split(/\s+/).filter(Boolean);
const isCall = (token: string): boolean => /^[A-Z0-9]{2,}(?:\?|[A-Z0-9/])*$/.test(token) && /[A-Z]/.test(token) && /\d|\?/.test(token);
const serial = (token: string): string | undefined => /^\d{1,5}$/.test(token) ? token.padStart(3, "0") : undefined;

export function parseContestTransmission(text: string, context: ContestTransmissionContext): OperatorIntent {
  const tokens = normalize(text); if (!tokens.length) return { kind: "unknown" };
  const joined = tokens.join(" ");
  if (joined === "AGN" || joined === "AGN?" || joined === "?" || joined === "PSE AGN") return { kind: "request-again" };
  if (joined === "CALL" || joined === "CALL?" || joined === "CL?") return { kind: "request-call" };
  if (joined === "NR" || joined === "NR?" || joined === "NUMBER?") return { kind: "request-number" };
  if (joined === "TU" || joined === "TNX" || joined === "TU EE" || joined === "RR TU" || /^R \d{1,5} TU$/.test(joined)) return { kind: "send-tu" };
  const rstIndex = tokens.findIndex((token) => token === "599" || token === "5NN");
  const calls = tokens.filter((token) => token !== "599" && token !== "5NN" && isCall(token));
  const number = tokens.filter((_, index) => index !== rstIndex).map(serial).find((value) => value !== undefined);
  const stationCall = context.stationCall.toUpperCase(); const operatorCall = context.operatorCall.toUpperCase();
  const call = calls.find((value) => value === stationCall || value !== operatorCall);
  if (rstIndex >= 0 && number && (calls.length || context.phase === "exchange")) return calls.length > 1 ? { kind: "send-call-and-exchange", call, rst: "599", serial: number } : { kind: "send-exchange", call, rst: "599", serial: number };
  if (calls.includes(stationCall) && (calls.includes(operatorCall) || calls.length >= 1)) return { kind: "call-station", copiedCall: operatorCall };
  if (context.phase === "calling" && calls.length === 1 && calls[0] === operatorCall) return { kind: "call-station", copiedCall: operatorCall };
  if (calls.length === 1 && calls[0]!.includes("?")) return { kind: "call-station", copiedCall: calls[0] };
  return { kind: "unknown" };
}
