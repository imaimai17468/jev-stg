import type { Grid } from "./grid";
import { valueAt, visitNeighbours } from "./grid";

/** The marker a cell or a province carries until a region reaches it. */
export const UNASSIGNED = -1;

/** Hands `visit` every neighbour of `from` in whatever graph is being walked. */
export type Neighbourhood = (
  from: number,
  visit: (neighbour: number) => void
) => void;

/**
 * Claims every unclaimed neighbour of the frontier with the value it was reached
 * from plus `step`, then recurses on what it just claimed.
 *
 * The recursion runs once per ring rather than once per member, so its depth is
 * the distance from a seed to the furthest thing it reaches rather than the
 * size of the graph. The cell lattice and the province graph are both walked
 * this way, which is why the neighbourhood arrives as an argument.
 */
const claimOutward = (
  values: Int32Array,
  neighbourhood: Neighbourhood,
  mayEnter: (index: number) => boolean,
  frontier: readonly number[],
  step: number
): void => {
  if (frontier.length === 0) {
    return;
  }
  const claimed: number[] = [];
  for (const from of frontier) {
    neighbourhood(from, (to) => {
      if (valueAt(values, to) !== UNASSIGNED) {
        return;
      }
      if (!mayEnter(to)) {
        return;
      }
      values[to] = valueAt(values, from) + step;
      claimed.push(to);
    });
  }
  claimOutward(values, neighbourhood, mayEnter, claimed, step);
};

/**
 * Advances every region by one step in each direction at once until nothing
 * unclaimed is left within reach, each claim carrying the seed's own value.
 */
export const spreadFrom = (
  assignments: Int32Array,
  neighbourhood: Neighbourhood,
  mayEnter: (index: number) => boolean,
  frontier: readonly number[]
): void => {
  claimOutward(assignments, neighbourhood, mayEnter, frontier, 0);
};

/** The cell lattice as `spreadFrom` walks it. */
export const overTheGrid =
  (grid: Grid) =>
  (from: number, visit: (neighbour: number) => void): void => {
    visitNeighbours(grid, from, visit);
  };

/**
 * A buffer of `count` entries, every one unassigned, which is what a spread
 * fills.
 */
export const unassignedBuffer = (count: number): Int32Array =>
  new Int32Array(count).fill(UNASSIGNED);

/**
 * How many steps each index is from the nearest seed, `UNASSIGNED` where the
 * walk never reaches it.
 *
 * `spreadFrom` carries a seed's own value outward, which answers who claimed
 * what. This carries the step count, which answers which way is toward them, so
 * anything walking the graph reads one neighbour rather than storing a route.
 */
export const distanceFrom = (
  count: number,
  neighbourhood: Neighbourhood,
  mayEnter: (index: number) => boolean,
  seeds: readonly number[]
): Int32Array => {
  const steps = unassignedBuffer(count);
  for (const seed of seeds) {
    steps[seed] = 0;
  }
  claimOutward(steps, neighbourhood, mayEnter, seeds, 1);
  return steps;
};
