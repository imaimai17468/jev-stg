import { Option } from "effect";
import type { World } from "@/shared/entities/world";
import { constructionProgress } from "@/shared/entities/world/economy";
import { countLabel } from "./count-label";
import type { NationSummary } from "./nation-summary";
import type { Stat } from "./stat";

/** What the top bar says: whose numbers these are, and the numbers. */
export interface Headline {
  readonly title: string;
  readonly stats: readonly Stat[];
}

const PERCENT = 100;

/**
 * The top bar's contents.
 *
 * A nation's readings are the ones the calendar moves, so the bar carries those
 * where a nation is picked and the world's fixed counts where none is. The
 * construction reading is floored rather than rounded, so it reaches 100 only
 * by the factory appearing in the count beside it.
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
        { label: "人的資源", value: countLabel(summary.economy.manpower) },
        {
          label: "工場",
          value: `民 ${summary.economy.civilianFactories} / 軍 ${summary.economy.militaryFactories}`,
        },
        { label: "装備", value: countLabel(summary.economy.equipment) },
        {
          label: "建設",
          value: `${Math.floor(constructionProgress(summary.economy) * PERCENT)}%`,
        },
      ],
      title: summary.name,
    }),
  });
