export const normalize = (value: string): string =>
  value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .trim()
    .toLowerCase();

export const isTargetInchText = (
  value: string,
  targetSizeInches: number
): boolean =>
  new RegExp(
    `\\b${targetSizeInches}\\s*(?:"|″|”|inch|inches|-\\s*inch)?\\b`,
    "i"
  ).test(value);
