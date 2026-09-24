import { Option } from "effect";
import type { World } from "@/shared/entities/world";
import type { Diplomacy } from "@/shared/entities/world/diplomacy";
import { nationsStanding } from "@/shared/entities/world/diplomacy";
import { constructionProgress } from "@/shared/entities/world/economy";
import { warCount } from "@/shared/entities/world/wars";
import { countLabel, percentLabel } from "./count-label";
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
 * The bar carries the picked nation's readings where a nation is picked, and
 * where none is, the world's: the nations an annexation has not removed, the
 * wars between them, the world tension, and the fixed counts of the map. The
 * construction reading is floored rather than rounded, so it reaches 100 only
 * by the factory appearing in the count beside it.
 */
export const headlineOf = (
  world: World,
  diplomacy: Diplomacy,
  selection: Option.Option<NationSummary>
): Headline =>
  Option.match(selection, {
    onNone: () => ({
      stats: [
        {
          label: "国",
          value: String(nationsStanding(diplomacy)),
        },
        { label: "戦争", value: String(warCount(diplomacy.wars)) },
        { label: "世界緊張度", value: percentLabel(diplomacy.tension) },
        { label: "州", value: String(world.provinces.length) },
        { label: "seed", value: String(world.seed) },
      ],
      title: "世界",
    }),
    onSome: (summary) => ({
      stats: [
        { label: "人的資源", value: countLabel(summary.economy.manpower) },
        { label: "師団", value: String(summary.divisions) },
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
