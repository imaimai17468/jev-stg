import type { SupplyNetwork } from "@/shared/entities/world/supply";

/** What the map colours its provinces by. */
export type MapMode = "political" | "supply";

/** Every map mode, in the order the controls offer them. */
export const MAP_MODES: readonly MapMode[] = ["political", "supply"];

/** How a repaint colours the provinces, with what that needs to know. */
export type Tint =
  | { readonly mode: "political" }
  | { readonly mode: "supply"; readonly network: SupplyNetwork };

const POLITICAL: Tint = { mode: "political" };

/**
 * The tint a map in `mode` repaints with. The political tint is one value, so
 * a repaint keyed on it does not rerun each day the supply network changes.
 */
export const tintFor = (mode: MapMode, network: SupplyNetwork): Tint => {
  if (mode === "supply") {
    return { mode, network };
  }
  return POLITICAL;
};
