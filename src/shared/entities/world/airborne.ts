/**
 * The transport planes a paradrop takes for each division in it, and the
 * fewest any drop takes, after Hearts of Iron IV's
 * `BASE_UNIT_WEIGHT_IN_TRANSPORT_PLANES` and `MIN_PLANE_COUNT_PARADROP`.
 */
export const TRANSPORTS_PER_DIVISION = 45;
const FEWEST_TRANSPORTS = 50;

/** The transport planes it takes to drop `divisions` paratrooper divisions at once, none for none. */
export const transportsFor = (divisions: number): number =>
  Math.max(
    FEWEST_TRANSPORTS * Number(divisions > 0),
    TRANSPORTS_PER_DIVISION * divisions
  );

/**
 * The share of the sky over a drop's base and its target a nation's side has
 * to hold, after Hearts of Iron IV's `PARADROP_AIR_SUPERIORITY_RATIO`.
 */
export const DROP_SUPERIORITY = 0.7;
