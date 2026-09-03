import { CallsignSelector, generatePlausibleCallsign, normalizeCallsignList } from "@gadx/runner-core";

const databaseUrl = `${import.meta.env.BASE_URL}data/callsigns.cqww-2025cw.json`;
let databasePromise: Promise<readonly string[]> | undefined;
let selectorPromise: Promise<CallsignSelector> | undefined;

export function loadCallsignDatabase(): Promise<readonly string[]> {
  databasePromise ??= fetch(databaseUrl)
    .then(async (response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload: unknown = await response.json();
      if (!Array.isArray(payload)) throw new Error("Formato inválido");
      const callsigns = normalizeCallsignList(payload);
      console.info(`Base CQ WW CW 2025: ${callsigns.length.toLocaleString("pt-BR")} estações carregadas.`);
      return callsigns;
    })
    .catch(() => []);
  return databasePromise;
}

async function getSelector(): Promise<CallsignSelector> {
  selectorPromise ??= loadCallsignDatabase().then((callsigns) => new CallsignSelector(callsigns, generatePlausibleCallsign));
  return selectorPromise;
}

export async function selectCallsigns(count: number, excluded: readonly string[] = []): Promise<string[]> {
  const selector = await getSelector();
  const selected: string[] = [];
  for (let index = 0; index < count; index += 1) selected.push(selector.next([...excluded, ...selected]));
  return selected;
}
