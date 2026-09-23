import type { Compliance } from "@/shared/entities/world/compliance";
import type { ResourceNeed } from "@/shared/entities/world/resources";
import { totalOf } from "@/shared/entities/world/resources";
import type { SupplyNetwork } from "@/shared/entities/world/supply";

/** What the map colours its provinces by. */
export type MapMode =
  | "political"
  | "supply"
  | "compliance"
  | "naval"
  | "resources";

/** Every map mode, in the order the controls offer them. */
export const MAP_MODES: readonly MapMode[] = [
  "political",
  "supply",
  "compliance",
  "naval",
  "resources",
];

/** How a repaint colours the provinces, with what that needs to know. */
export type Tint =
  | { readonly mode: "political" }
  | { readonly mode: "supply"; readonly network: SupplyNetwork }
  | { readonly mode: "compliance"; readonly compliance: Compliance }
  | {
      readonly mode: "naval";
      /** Every nation's weight over each zone, by nation id and then province id. */
      readonly waters: readonly Float32Array[];
    }
  | {
      readonly mode: "resources";
      /** What each province yields a day, by province id. */
      readonly deposits: readonly ResourceNeed[];
      /** What the whole world yields a day. */
      readonly world: ResourceNeed;
    };

/** The tint of the resource map, which only a new world changes. */
type ResourceTint = Extract<Tint, { readonly mode: "resources" }>;

/**
 * The resource map's tint for a world's deposits, built once per world so a
 * repaint keyed on it does not rerun as the days pass.
 */
export const resourceTintOf = (
  deposits: readonly ResourceNeed[]
): ResourceTint => ({ deposits, mode: "resources", world: totalOf(deposits) });

/** What the map modes other than the political one colour by. */
export interface Readings {
  readonly network: SupplyNetwork;
  readonly compliance: Compliance;
  readonly waters: readonly Float32Array[];
  readonly resources: ResourceTint;
}

const POLITICAL: Tint = { mode: "political" };

/**
 * The tint a map in `mode` repaints with. The political tint is one value and
 * the resource tint is the one the readings carry, so a repaint keyed on
 * either does not rerun each day the other readings change.
 */
export const tintFor = (mode: MapMode, readings: Readings): Tint => {
  if (mode === "supply") {
    return { mode, network: readings.network };
  }
  if (mode === "compliance") {
    return { compliance: readings.compliance, mode };
  }
  if (mode === "naval") {
    return { mode, waters: readings.waters };
  }
  if (mode === "resources") {
    return readings.resources;
  }
  return POLITICAL;
};
