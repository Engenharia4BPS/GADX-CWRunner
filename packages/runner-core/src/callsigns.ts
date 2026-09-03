export type CallsignFallback = (random?: () => number) => string;

const normalizeCallsign = (value: string): string => value.trim().toUpperCase();

export function normalizeCallsignList(values: readonly unknown[]): string[] {
  const unique = new Set<string>();
  for (const value of values) {
    if (typeof value !== "string") continue;
    const callsign = normalizeCallsign(value);
    if (/^[A-Z0-9]+(?:\/[A-Z0-9]+)*$/.test(callsign)) unique.add(callsign);
  }
  return [...unique];
}

export class CallsignSelector {
  private readonly recent: string[] = [];
  private readonly callsigns: readonly string[];
  private readonly fallback: CallsignFallback;
  private readonly random: () => number;
  private readonly recentLimit: number;

  constructor(
    callsigns: readonly string[],
    fallback: CallsignFallback,
    random: () => number = Math.random,
    recentLimit = 20,
  ) {
    this.callsigns = callsigns;
    this.fallback = fallback;
    this.random = random;
    this.recentLimit = recentLimit;
  }

  next(excluded: readonly string[] = []): string {
    const blocked = new Set([...this.recent, ...excluded].map(normalizeCallsign));
    const available = this.callsigns.filter((callsign) => !blocked.has(callsign));
    let selected = available[Math.floor(this.random() * available.length)];
    for (let attempt = 0; !selected && attempt < 40; attempt += 1) {
      const fallback = normalizeCallsign(this.fallback(this.random));
      if (!blocked.has(fallback)) selected = fallback;
    }
    selected ??= normalizeCallsign(this.fallback(this.random));
    this.recent.push(selected);
    while (this.recent.length > this.recentLimit) this.recent.shift();
    return selected;
  }

  get recentCallsigns(): readonly string[] { return [...this.recent]; }
}
