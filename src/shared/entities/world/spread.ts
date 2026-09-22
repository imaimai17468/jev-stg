import { valueAt } from "./grid";

/** The marker a cell or a province carries until a region reaches it. */
export const UNASSIGNED = -1;

/** Hands `visit` every neighbour of `from` in whatever graph is being walked. */
export type Neighbourhood = (
  from: number,
  visit: (neighbour: number) => void
) => void;

/**
 * Advances every region by one step in each direction at once, then recurses on
 * what it just claimed.
 *
 * The recursion runs once per ring rather than once per member, so its depth is
 * the distance from a seed to the furthest thing it wins rather than the size of
 * the graph. The cell lattice and the province graph are both walked this way,
 * which is why the neighbourhood arrives as an argument.
 */
export const spreadFrom = (
  assignments: Int32Array,
  neighbourhood: Neighbourhood,
  mayEnter: (index: number) => boolean,
  frontier: readonly number[]
): void => {
  if (frontier.length === 0) {
    return;
  }
  const claimed: number[] = [];
  for (const from of frontier) {
    neighbourhood(from, (to) => {
      if (valueAt(assignments, to) !== UNASSIGNED) {
        return;
      }
      if (!mayEnter(to)) {
        return;
      }
      assignments[to] = valueAt(assignments, from);
      claimed.push(to);
    });
  }
  spreadFrom(assignments, neighbourhood, mayEnter, claimed);
};
