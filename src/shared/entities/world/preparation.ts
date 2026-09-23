import type { Division } from "./divisions";

/**
 * The most levels of entrenchment a division digs. Hearts of Iron IV's cap
 * could not be confirmed, so the cap is this game's own.
 */
export const MOST_ENTRENCHMENT = 10;

/** Hearts of Iron IV's entrenchment: a level a day, each worth 2% to attack and defence. */
const ENTRENCHMENT_PER_DAY = 1;
const WORTH_PER_ENTRENCHMENT = 0.02;

/**
 * The planning bonus: 2% a day while holding the front, up to 30%, and 1% a
 * day lost doing anything else but defending, each 1% of it adding 1% to
 * attack. The gain, the cap, the loss and the attack are Hearts of Iron IV's,
 * where the loss runs once a plan is under way; losing it off the front too
 * is this game's own.
 */
export const MOST_PLANNING = 0.3;
const PLANNING_PER_DAY = 0.02;
const PLANNING_LOST_PER_DAY = 0.01;

/** What a division did today, which decides how its entrenchment and planning move. */
export type Activity =
  /** Standing still on its front, facing the enemy. */
  | "holding-front"
  /** Standing still anywhere else: in reserve, on a quiet border, or on the fallback line. */
  | "holding"
  /** Walking, or arrived in a new province today. */
  | "marching"
  /** Walking into the enemy's ground, or fighting on it. */
  | "attacking"
  /** Holding its own ground under attack. */
  | "defending";

/** How one day of an activity moves a division's entrenchment and planning. */
interface Effect {
  readonly entrench: (levels: number) => number;
  readonly plan: (planning: number) => number;
}

const dug = (levels: number): number =>
  Math.min(MOST_ENTRENCHMENT, levels + ENTRENCHMENT_PER_DAY);

const abandoned = (): number => 0;

const kept = (value: number): number => value;

const planned = (planning: number): number =>
  Math.min(MOST_PLANNING, planning + PLANNING_PER_DAY);

const spent = (planning: number): number =>
  Math.max(0, planning - PLANNING_LOST_PER_DAY);

/**
 * A division digs in wherever it stands out of battle and keeps its trenches
 * while it holds them under attack, and loses them the moment it moves or
 * attacks. It plans only on its front: fighting for its own ground keeps what
 * it has planned, and everything else spends it.
 */
const EFFECTS = {
  attacking: { entrench: abandoned, plan: spent },
  defending: { entrench: kept, plan: kept },
  holding: { entrench: dug, plan: spent },
  "holding-front": { entrench: dug, plan: planned },
  marching: { entrench: abandoned, plan: spent },
} satisfies Readonly<Record<Activity, Effect>>;

/** The division with one day of `activity` worked into its entrenchment and planning. */
export const prepared = (division: Division, activity: Activity): Division => {
  const effect = EFFECTS[activity];
  return {
    ...division,
    entrenchment: effect.entrench(division.entrenchment),
    planning: effect.plan(division.planning),
  };
};

/** The share its entrenchment adds to a division's attack and defence. */
export const entrenchedShare = (division: Division): number =>
  division.entrenchment * WORTH_PER_ENTRENCHMENT;
