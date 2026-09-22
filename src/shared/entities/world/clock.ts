import type { GameDate } from "./calendar";
import { civilFromDays, daysFromCivil } from "./calendar";

/** How fast the world runs, from the slowest setting to the fastest. */
export type Speed = 1 | 2 | 3 | 4 | 5;

/** Every speed, in the order the controls offer them. */
export const SPEEDS: readonly Speed[] = [1, 2, 3, 4, 5];

/**
 * In-game days one real second covers at each speed.
 *
 * The slowest is half a day a second, which is a pace a war can be followed at,
 * and the fastest is a season a minute, which is for the years between them.
 */
const DAYS_PER_SECOND = {
  1: 0.5,
  2: 1,
  3: 2,
  4: 5,
  5: 12,
} satisfies Readonly<Record<Speed, number>>;

const MILLISECONDS = 1000;

/** The day the world starts on. */
const START_DATE: GameDate = { day: 1, month: 1, year: 1936 };

/** Where the world's calendar stands and how fast it is moving. */
export interface Clock {
  /** Days since the start date. */
  readonly days: number;
  readonly speed: Speed;
  readonly paused: boolean;
}

export const START_CLOCK: Clock = { days: 0, paused: false, speed: 2 };

/** The date the clock reads. */
export const dateOf = (clock: Clock): GameDate =>
  civilFromDays(daysFromCivil(START_DATE) + clock.days);

/** The clock one day on, which is the step the world is simulated in. */
export const advancedOneDay = (clock: Clock): Clock => ({
  ...clock,
  days: clock.days + 1,
});

/** How long one in-game day lasts, in milliseconds of real time. */
export const dayDuration = (clock: Clock): number =>
  MILLISECONDS / DAYS_PER_SECOND[clock.speed];

/**
 * The clock running at `speed`.
 *
 * Choosing a speed also starts a paused clock, because reaching for a speed is
 * how someone says they want to watch.
 */
export const atSpeed = (clock: Clock, speed: Speed): Clock => ({
  ...clock,
  paused: false,
  speed,
});

export const togglePaused = (clock: Clock): Clock => ({
  ...clock,
  paused: !clock.paused,
});
