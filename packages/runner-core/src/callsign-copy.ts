export type CallCopyKind = "exact" | "almost" | "wrong";
export interface CallCopyResult { kind: CallCopyKind; normalizedExpected: string; normalizedCopied: string; hasWildcard: boolean; distance: number; reason: string; }

const normalize = (value: string): string => value.trim().toUpperCase().replace(/[^A-Z0-9/?]/g, "");
const editDistance = (left: string, right: string): number => { const row = Array.from({ length: right.length + 1 }, (_, index) => index); for (let i = 1; i <= left.length; i += 1) { let previous = row[0]!; row[0] = i; for (let j = 1; j <= right.length; j += 1) { const saved = row[j]!; row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, previous + (left[i - 1] === right[j - 1] ? 0 : 1)); previous = saved; } } return row[right.length]!; };
const isSubsequence = (needle: string, haystack: string): boolean => { let index = 0; for (const character of haystack) if (character === needle[index]) index += 1; return index === needle.length; };

export function analyzeCallCopy(expected: string, copied: string): CallCopyResult {
  const normalizedExpected = normalize(expected); const normalizedCopied = normalize(copied); const hasWildcard = normalizedCopied.includes("?"); const known = normalizedCopied.replaceAll("?", ""); const distance = editDistance(known, normalizedExpected);
  if (!normalizedExpected || known.length < 2) return { kind: "wrong", normalizedExpected, normalizedCopied, hasWildcard, distance, reason: "poucos-caracteres-coerentes" };
  if (!hasWildcard && normalizedCopied === normalizedExpected) return { kind: "exact", normalizedExpected, normalizedCopied, hasWildcard, distance: 0, reason: "igualdade-total" };
  const wildcardFits = hasWildcard && isSubsequence(known, normalizedExpected);
  const plausible = wildcardFits || normalizedExpected.includes(known) || isSubsequence(known, normalizedExpected) || distance <= 1;
  return { kind: plausible ? "almost" : "wrong", normalizedExpected, normalizedCopied, hasWildcard, distance, reason: plausible ? hasWildcard ? "trecho-desconhecido" : "alinhamento-plausivel" : "sem-alinhamento" };
}
