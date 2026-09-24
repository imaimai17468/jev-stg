import { Option } from "effect";

/** A war goal one nation justifies on another, which it needs to declare on it. */
export interface WarGoal {
  readonly nation: number;
  readonly target: number;
  /** Days since the start date, on the day the justification completes. */
  readonly readyOn: number;
}

/**
 * Where a war goal stands on a day: still being justified, justified and
 * ready to declare on, or past the days it stays good for.
 */
export type WarGoalStanding = "justifying" | "justified" | "expired";

/**
 * How many days a justification takes at no world tension. Hearts of Iron IV
 * puts it at six to nine months, and this game takes the middle.
 */
const JUSTIFYING_DAYS = 180;

/**
 * The share of the justifying days that full world tension cuts, which
 * Hearts of Iron IV puts at half.
 */
const TENSION_CUT = 0.5;

/** How many days a justified war goal stays good for, as in Hearts of Iron IV. */
export const JUSTIFIED_DAYS = 60;

/** How many days justifying a war goal takes at `tension`. */
export const justifyingDays = (tension: number): number =>
  Math.round(JUSTIFYING_DAYS * (1 - TENSION_CUT * tension));

export const warGoalStanding = (
  goal: WarGoal,
  day: number
): WarGoalStanding => {
  if (day < goal.readyOn) {
    return "justifying";
  }
  if (day < goal.readyOn + JUSTIFIED_DAYS) {
    return "justified";
  }
  return "expired";
};

/** The war goal `nation` justifies or has justified, if it has one. */
export const warGoalOf = (
  goals: readonly WarGoal[],
  nation: number
): Option.Option<WarGoal> =>
  Option.fromUndefinedOr(goals.find((goal) => goal.nation === nation));

/** The target `nation` holds a justified war goal on at `day`, if it holds one. */
export const justifiedTarget = (
  goals: readonly WarGoal[],
  nation: number,
  day: number
): Option.Option<number> =>
  warGoalOf(goals, nation).pipe(
    Option.filter((goal) => warGoalStanding(goal, day) === "justified"),
    Option.map((goal) => goal.target)
  );

/** The war goals without `nation`'s. */
export const withoutGoalOf = (
  goals: readonly WarGoal[],
  nation: number
): readonly WarGoal[] => goals.filter((goal) => goal.nation !== nation);
