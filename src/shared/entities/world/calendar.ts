/** A day in the world's calendar. */
export interface GameDate {
  readonly year: number;
  /** 1 for January through 12 for December. */
  readonly month: number;
  readonly day: number;
}

/** Days in the 400-year cycle the Gregorian calendar repeats on. */
const ERA_DAYS = 146_097;
/** Days between 0000-03-01 and 1970-01-01, which shifts the era to the epoch. */
const EPOCH_SHIFT = 719_468;

const floorDiv = (value: number, by: number): number => Math.floor(value / by);

/**
 * Days since 1970-01-01 for a civil date, by Howard Hinnant's algorithm.
 *
 * The year starts in March inside it, which is what puts the leap day at the end
 * of the cycle and leaves the whole conversion as arithmetic with no table of
 * month lengths and no branch on which year is a leap year.
 */
export const daysFromCivil = (date: GameDate): number => {
  const shiftedYear = date.year - Number(date.month <= 2);
  const era = floorDiv(shiftedYear, 400);
  const yearOfEra = shiftedYear - era * 400;
  const marchMonth = date.month + (-3 + Number(date.month <= 2) * 12);
  const dayOfYear = floorDiv(153 * marchMonth + 2, 5) + date.day - 1;
  const dayOfEra =
    yearOfEra * 365 +
    floorDiv(yearOfEra, 4) -
    floorDiv(yearOfEra, 100) +
    dayOfYear;
  return era * ERA_DAYS + dayOfEra - EPOCH_SHIFT;
};

/** The civil date `days` after 1970-01-01, the inverse of the above. */
export const civilFromDays = (days: number): GameDate => {
  const shifted = days + EPOCH_SHIFT;
  const era = floorDiv(shifted, ERA_DAYS);
  const dayOfEra = shifted - era * ERA_DAYS;
  const yearOfEra = floorDiv(
    dayOfEra -
      floorDiv(dayOfEra, 1460) +
      floorDiv(dayOfEra, 36_524) -
      floorDiv(dayOfEra, 146_096),
    365
  );
  const shiftedYear = yearOfEra + era * 400;
  const dayOfYear =
    dayOfEra -
    (365 * yearOfEra + floorDiv(yearOfEra, 4) - floorDiv(yearOfEra, 100));
  const marchMonth = floorDiv(5 * dayOfYear + 2, 153);
  const day = dayOfYear - floorDiv(153 * marchMonth + 2, 5) + 1;
  const month = marchMonth + (3 - Number(marchMonth >= 10) * 12);
  return { day, month, year: shiftedYear + Number(month <= 2) };
};
