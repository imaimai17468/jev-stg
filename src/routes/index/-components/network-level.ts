import { Option } from "effect";
import { valueAt } from "@/shared/entities/world/grid";
import { itemAt } from "@/shared/entities/world/lookup";
import type { Networks } from "@/shared/entities/world/networks";
import { NETWORK_FLOOR } from "@/shared/entities/world/networks";

/**
 * How a province reads on the intelligence map: no network there, one still
 * too weak to count, one that counts, or one strong enough for the
 * operations that need the most.
 */
export type NetworkLevel = "none" | "building" | "counts" | "strong";

/** Every level, from no network to the strongest, in the order the legend lists them. */
export const NETWORK_LEVELS: readonly NetworkLevel[] = [
  "none",
  "building",
  "counts",
  "strong",
];

/** The strength an infiltration of the armed forces and a stolen army blueprint need. */
const STRONG_FROM = 50;

/** The level a network of `strength` reads at. */
export const networkLevelOf = (strength: number): NetworkLevel => {
  if (strength >= STRONG_FROM) {
    return "strong";
  }
  if (strength >= NETWORK_FLOOR) {
    return "counts";
  }
  if (strength > 0) {
    return "building";
  }
  return "none";
};

/** No network, where the list does not reach a nation. */
const NO_NETWORK = new Float32Array(0);

/**
 * The network strength the intelligence map shows in `province`: the picked
 * nation's own network there, or, with nobody picked, the strongest network
 * any nation other than its holder has there.
 */
export const strengthShown = (
  networks: Networks,
  province: number,
  holder: number,
  picked: Option.Option<number>
): number => {
  if (Option.isSome(picked)) {
    return valueAt(itemAt(networks, picked.value, NO_NETWORK), province);
  }
  return Math.max(
    0,
    ...networks.map(
      (network, spy) => valueAt(network, province) * Number(spy !== holder)
    )
  );
};
