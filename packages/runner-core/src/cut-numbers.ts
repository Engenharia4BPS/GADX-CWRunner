/**
 * Substitui algarismos pelas abreviações de concurso (cut numbers), mantendo
 * os caracteres que não são numéricos. Ex.: 599 001 vira 5NN TTA.
 */
const CUT_NUMBERS: Readonly<Record<string, string>> = {
  0: "T", 1: "A", 9: "N",
};

export function abbreviateCwNumbers(value: string): string {
  return value.replace(/\d/g, (digit) => CUT_NUMBERS[digit] ?? digit);
}
