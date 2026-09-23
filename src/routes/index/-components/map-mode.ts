import type { Compliance } from "@/shared/entities/world/compliance";
import type { SupplyNetwork } from "@/shared/entities/world/supply";

/** What the map colours its provinces by. */
export type MapMode = "political" | "supply" | "compliance";

/** Every map mode, in the order the controls offer them. */
export const MAP_MODES: readonly MapMode[] = [
  "political",
  "supply",
  "compliance",
];

/** How a repaint colours the provinces, with what that needs to know. */
export type Tint =
  | { readonly mode: "political" }
  | { readonly mode: "supply"; readonly network: SupplyNetwork }
  | { readonly mode: "compliance"; readonly compliance: Compliance };

/** What the map modes other than the political one colour by. */
export interface Readings {
  readonly network: SupplyNetwork;
  readonly compliance: Compliance;
}

const POLITICAL: Tint = { mode: "political" };

/**
 * The tint a map in `mode` repaints with. The political tint is one value, so
 * a repaint keyed on it does not rerun each day the readings change.
 */
export const tintFor = (mode: MapMode, readings: Readings): Tint => {
  if (mode === "supply") {
    return { mode, network: readings.network };
  }
  if (mode === "compliance") {
    return { compliance: readings.compliance, mode };
  }
  return POLITICAL;
};
