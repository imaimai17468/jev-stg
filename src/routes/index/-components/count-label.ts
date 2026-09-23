/** How many digits stand between two separators. */
const GROUP = 3;
const TRIPLES = /\d{3}/gu;

/**
 * A count with a separator every three digits.
 *
 * The HUD's counters move by a few hundred a day against a total in the
 * millions, and the separators are what make that movement readable without
 * counting the digits. A minus sign is taken off before the digits are grouped,
 * because counting it as a digit puts a separator right after it.
 */
export const countLabel = (value: number): string => {
  const rounded = Math.round(value);
  const digits = String(Math.abs(rounded));
  const lead = digits.length % GROUP;
  const head = digits.slice(0, lead);
  const rest = digits.slice(lead).match(TRIPLES) ?? [];
  const grouped = [head, ...rest].filter((part) => part.length > 0).join(",");
  return `${"-".repeat(Number(rounded < 0))}${grouped}`;
};

const PERCENT = 100;

/** A share from 0 to 1 as a whole percentage. */
export const percentLabel = (share: number): string =>
  `${Math.round(share * PERCENT)}%`;

/** The average of `levels` written by `format`, or a dash where there are none. */
export const averageLabel = (
  levels: readonly number[],
  format: (average: number) => string
): string => {
  if (levels.length === 0) {
    return "—";
  }
  return format(
    levels.reduce((total, level) => total + level, 0) / levels.length
  );
};
