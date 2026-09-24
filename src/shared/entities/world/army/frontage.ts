import type { Terrain } from "../geography/terrain";

/**
 * How many divisions a side can put into one battle on each terrain when it
 * attacks from a single direction. Open ground has room for a broad attack,
 * and a mountain pass for a few divisions at a time.
 */
const BASE_WIDTH = {
  desert: 8,
  forest: 6,
  hills: 5,
  mountains: 4,
  plains: 8,
  tundra: 6,
} satisfies Readonly<Record<Terrain, number>>;

/** The share of the base width each further direction of attack adds. */
const WIDTH_PER_DIRECTION = 0.5;

/** The most directions a battle widens for, however many sides it is hit from. */
const MOST_DIRECTIONS = 3;

/**
 * How many divisions each side can have fighting at once in a battle on
 * `terrain` attacked from `directions` neighbouring provinces. The rest stand
 * in reserve and step in as the ones fighting break.
 */
export const combatWidth = (terrain: Terrain, directions: number): number =>
  Math.round(
    BASE_WIDTH[terrain] *
      (1 +
        WIDTH_PER_DIRECTION *
          (Math.min(MOST_DIRECTIONS, Math.max(1, directions)) - 1))
  );
