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
  | "air"
  | "resources";

/** Every map mode, in the order the controls offer them. */
export const MAP_MODES: readonly MapMode[] = [
  "political",
  "supply",
  "compliance",
  "naval",
  "air",
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
      readonly mode: "air";
      /** Every nation's air power over each region, by nation id and then region id. */
      readonly power: readonly Float32Array[];
      /** The region each province lies in, by province id. */
      readonly regionOf: Int32Array;
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

/** The tint of the air map, which a new day's air battles change. */
type AirTint = Extract<Tint, { readonly mode: "air" }>;

/** The air map's tint for the air power every nation flew over each region today. */
export const airTintOf = (
  power: readonly Float32Array[],
  regionOf: Int32Array
): AirTint => ({ mode: "air", power, regionOf });

/** What the map modes other than the political one colour by. */
export interface Readings {
  readonly network: SupplyNetwork;
  readonly compliance: Compliance;
  readonly waters: readonly Float32Array[];
  readonly air: AirTint;
  readonly resources: ResourceTint;
}

const POLITICAL: Tint = { mode: "political" };

/**
 * The tint a map in `mode` repaints with. The political tint is one value, and
 * the air and the resource tints are the ones the readings carry, so a
 * repaint keyed on any of them does not rerun each day the other readings
 * change.
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
  if (mode === "air") {
    return readings.air;
  }
  if (mode === "resources") {
    return readings.resources;
  }
  return POLITICAL;
};
