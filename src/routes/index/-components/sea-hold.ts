import { valueAt } from "@/shared/entities/world/grid";
import { UNASSIGNED } from "@/shared/entities/world/spread";

/**
 * How a sea zone reads on the naval map: no warship covers it, one nation's
 * covers all but a sliver of it, or two or more share it.
 */
export type SeaHoldLevel = "held" | "contested" | "empty";

/** Every level, in the order the legend lists them. */
export const SEA_HOLD_LEVELS: readonly SeaHoldLevel[] = [
  "held",
  "contested",
  "empty",
];

/** Who holds a sea zone on the naval map, and how firmly. */
export interface SeaHold {
  readonly level: SeaHoldLevel;
  /** The nation with the most weight there, or `UNASSIGNED` where no ship is. */
  readonly leader: number;
}

/** The share of a zone's weight the leading nation needs for it to read as held. */
const HELD_SHARE = 0.9;

/**
 * How the naval map reads `zone`, given every nation's weight over each zone:
 * held by the nation with the most weight there where it has nine tenths of
 * all of it, contested where it has less, and empty where nobody has any.
 */
export const seaHoldOf = (
  waters: readonly Float32Array[],
  zone: number
): SeaHold => {
  const weights = waters.map((weightsOf) => valueAt(weightsOf, zone));
  const most = Math.max(0, ...weights);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (most === 0) {
    return { leader: UNASSIGNED, level: "empty" };
  }
  const leader = weights.indexOf(most);
  if (most < HELD_SHARE * total) {
    return { leader, level: "contested" };
  }
  return { leader, level: "held" };
};
