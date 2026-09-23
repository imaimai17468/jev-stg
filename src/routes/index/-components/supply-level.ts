import { Option } from "effect";
import type {
  SupplyNetwork,
  SupplyState,
} from "@/shared/entities/world/supply";
import { postOf, supplyStateOf } from "@/shared/entities/world/supply";

/**
 * How a province reads on the supply map, from its holder's side: plenty to
 * spare, a little to spare, nothing to spare, short, or far short. The five
 * steps follow the ones Hearts of Iron IV's supply map paints.
 */
export type SupplyLevel = "plenty" | "some" | "stretched" | "short" | "starved";

/** Every level, from the most supply to the least, in the order the legend lists them. */
export const SUPPLY_LEVELS: readonly SupplyLevel[] = [
  "plenty",
  "some",
  "stretched",
  "short",
  "starved",
];

/** The divisions to spare a province needs before it reads as having plenty. */
const PLENTY_SPARE = 10;

/** The divisions to spare it needs before it reads as having some. */
const SOME_SPARE = 2;

/** A level that says an army standing in the province is short of supply. */
type Shortfall = Extract<SupplyLevel, SupplyState>;

/** Every shortfall, the worst first. */
const SHORTFALLS: readonly Shortfall[] = ["starved", "short"];

/** How short the worst-off of the armies standing in `province` is, where any is. */
const worstIn = (
  network: SupplyNetwork,
  province: number
): Option.Option<Shortfall> => {
  const states = new Set(
    Array.from({ length: network.nations }, (_, nation) =>
      postOf(network, nation, province)
    ).flatMap((post) => {
      if (post.demand === 0) {
        return [];
      }
      return [supplyStateOf(post.fill)];
    })
  );
  return Option.fromUndefinedOr(SHORTFALLS.find((level) => states.has(level)));
};

/**
 * The level of `province`: short or starved where any army standing in it,
 * the holder's or an attacker's, gets less than it needs, and otherwise by how
 * many more divisions its holder could keep supplied there.
 */
export const supplyLevelOf = (
  network: SupplyNetwork,
  holder: number,
  province: number
): SupplyLevel => {
  const worst = worstIn(network, province);
  if (Option.isSome(worst)) {
    return worst.value;
  }
  const post = postOf(network, holder, province);
  const spare = post.capacity - post.demand;
  if (spare >= PLENTY_SPARE) {
    return "plenty";
  }
  if (spare >= SOME_SPARE) {
    return "some";
  }
  return "stretched";
};

/**
 * Where the stripes cross a legend swatch `size` wide for a level striped
 * every `hatch` cells, as the offsets of each diagonal from the top-left
 * corner, and none where the level is not striped.
 */
export const stripeOffsets = (
  hatch: number,
  size: number
): readonly number[] => {
  if (hatch === 0) {
    return [];
  }
  return Array.from(
    { length: Math.floor((size * 2) / hatch) },
    (_, index) => (index + 1) * hatch
  );
};
