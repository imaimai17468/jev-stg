import { Option } from "effect";
import type { World } from "@/shared/entities/world";
import type { NationSummary } from "./nation-summary";

/** One reading in the bar across the top of the map. */
export interface Stat {
  readonly label: string;
  readonly value: string;
}

/** What the top bar says: whose numbers these are, and the numbers. */
export interface Headline {
  readonly title: string;
  readonly stats: readonly Stat[];
}

/**
 * The top bar's contents.
 *
 * The bar carries the selected nation where there is one and the world where
 * there is not, so the same four slots stay in the same places and the eye does
 * not have to find them again after a click.
 */
export const headlineOf = (
  world: World,
  selection: Option.Option<NationSummary>
): Headline =>
  Option.match(selection, {
    onNone: () => ({
      stats: [
        { label: "国", value: String(world.nations.length) },
        { label: "州", value: String(world.provinces.length) },
        { label: "seed", value: String(world.seed) },
      ],
      title: "世界",
    }),
    onSome: (summary) => ({
      stats: [
        { label: "州", value: String(summary.provinces) },
        { label: "面積", value: String(summary.cells) },
        { label: "隣接", value: String(summary.neighbours.length) },
      ],
      title: summary.name,
    }),
  });
