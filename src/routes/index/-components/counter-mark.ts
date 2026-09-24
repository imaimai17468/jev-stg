import { itemAt } from "@/shared/entities/world/lookup";
import type { Colour } from "@/shared/entities/world/nations";
import { NO_NATION } from "@/shared/entities/world/nations";
import type { World } from "@/shared/entities/world/world";

/** One counter the map draws over a place for what one nation has there. */
export interface CounterMark {
  /** Where the counter sits, in cell coordinates. */
  readonly x: number;
  readonly y: number;
  /** What it stands for, rounded to whole ones. */
  readonly count: number;
  readonly colour: Colour;
}

/** Where a counter would sit, and how much each nation has there. */
export interface Tally {
  readonly x: number;
  readonly y: number;
  /** The nations with anything there. */
  readonly nations: readonly number[];
  /** What each of `nations` has there, in the same order. */
  readonly counts: readonly number[];
}

/**
 * The counter for the nation with the most at a place, in its colour, which
 * is the one fighting for it, and none where nobody has so much as one.
 */
export const leadingMark = (
  world: World,
  tally: Tally
): readonly CounterMark[] => {
  const most = Math.max(0, ...tally.counts);
  if (most < 1) {
    return [];
  }
  const nation = itemAt(
    tally.nations,
    tally.counts.indexOf(most),
    NO_NATION.id
  );
  return [
    {
      colour: itemAt(world.nations, nation, NO_NATION).colour,
      count: Math.round(most),
      x: tally.x,
      y: tally.y,
    },
  ];
};
