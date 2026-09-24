import type { Focuses } from "./focus";
import type { PeaceTerms } from "./peace";

/**
 * What raises world tension. Hearts of Iron IV raises it for justifying a war
 * goal, declaring a war, joining a faction and taking ground, so these are
 * its causes, and the amounts below are this game's own.
 */
export type TensionCause = "justify" | "declare" | "join" | PeaceTerms;

/** How much each cause raises world tension, as a share of the whole. */
const TENSION_FROM = {
  annex: 0.1,
  cede: 0.02,
  declare: 0.08,
  join: 0.02,
  justify: 0.03,
  puppet: 0.05,
} satisfies Readonly<Record<TensionCause, number>>;

/** World tension once `cause` has raised it, never past the whole. */
export const tensionRaised = (tension: number, cause: TensionCause): number =>
  Math.min(1, tension + TENSION_FROM[cause]);

/**
 * How much world tension falls each day nobody is fighting. Hearts of Iron IV
 * keeps the tension a nation at war raised from falling at all, and this
 * game reads that as the whole world's tension holding while any war runs.
 */
const EASING_PER_DAY = 0.0005;

/** World tension after one day, with `fighting` telling whether any war runs. */
export const tensionEasedOneDay = (
  tension: number,
  fighting: boolean
): number => {
  if (fighting) {
    return tension;
  }
  return Math.max(0, tension - EASING_PER_DAY);
};

/**
 * The world tension a nation needs before it may justify a war goal, read
 * off the political focus it finished. Hearts of Iron IV lets a fascist
 * nation justify at any tension, a non-aligned one from 50% and a democracy
 * only at 100%, and this game has militarism, no stand at all and neutrality
 * in those three places.
 */
export const justifyingThreshold = (focuses: Focuses): number => {
  if (focuses.done.includes("militarism")) {
    return 0;
  }
  if (focuses.done.includes("neutrality")) {
    return 1;
  }
  return 0.5;
};

/** Whether a nation that finished `focuses` may justify a war goal at `tension`. */
export const mayJustifyAt = (focuses: Focuses, tension: number): boolean =>
  tension >= justifyingThreshold(focuses);
